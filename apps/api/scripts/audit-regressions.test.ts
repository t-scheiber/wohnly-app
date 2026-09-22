import assert from "node:assert/strict";
import { test, afterEach, mock } from "node:test";
import { Decimal } from "@prisma/client-runtime-utils";
import { auth } from "../src/auth.js";
import { prisma } from "../src/lib/prisma.js";
import { expenseSplits } from "../src/lib/money-splits.js";
import { schemas, pagination } from "../src/lib/request-validation.js";
import todos from "../src/routes/todos.js";
import events from "../src/routes/events.js";
import expenses from "../src/routes/expenses.js";
import invitations from "../src/routes/invitations.js";
import deletion from "../src/routes/deletion.js";
import webhooks from "../src/routes/webhooks.js";
import { visibleEventsWhere } from "../src/lib/event-visibility.js";
import { cleanMemberDeparture } from "../src/lib/member-departure.js";
import { getChoreOccurrences } from "../../../packages/shared/src/utils/chore-schedule.js";

const restores: (() => void)[] = [];
function stub(object: any, key: string, impl: (...args: any[]) => any) { const original = object[key]; const fn = mock.fn(impl); object[key] = fn; restores.push(() => { object[key] = original; }); return fn; }
afterEach(() => { for (const restore of restores.splice(0).reverse()) restore(); mock.restoreAll(); });
function session() {
  stub(auth.api, "getSession", async () => ({ response: { user: { id: "u1", email: "test@example.com", name: "Test" } }, headers: new Headers() }));
  stub(prisma.householdMember, "findFirst", async () => ({ id: "m1", userId: "u1", householdId: "h1", role: "MEMBER" }));
}
function req(body: unknown, method = "POST") { return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }; }

test("cent allocation preserves totals, fixed/percentage/shares/itemized splits", () => {
  const total = new Decimal(10);
  assert.deepEqual(expenseSplits(total, ["a","b","c"]).map(s => [s.memberId,s.amount.toString()]), [["a","3.34"],["b","3.33"],["c","3.33"]]);
  assert.deepEqual(expenseSplits(total,["a","b"],"fixed",[{memberId:"a",amount:3},{memberId:"b",amount:7}]).map(s=>s.amount.toString()),["3","7"]);
  for (const type of ["percentage","shares"]) {
    const rows=expenseSplits(total,["a","b"],type,[{memberId:"a",percentage:25,shares:1},{memberId:"b",percentage:75,shares:3}]);
    assert.deepEqual(rows.map(s=>s.amount.toString()),["2.5","7.5"]);
  }
  const rows=expenseSplits(total,["a","b"],"itemized",undefined,[{amount:7,assigneeIds:["a"]},{amount:3,assigneeIds:["a","b"]}]);
  assert.deepEqual(rows.map(s=>s.amount.toString()),["8.5","1.5"]);
});
test("invalid split totals, outsiders, duplicate members and zero weights are rejected", () => {
  for (const splits of [[{memberId:"a",amount:2}],[{memberId:"outside",amount:10}],[{memberId:"a",amount:5},{memberId:"a",amount:5}]]) {
    assert.throws(()=>expenseSplits(new Decimal(10),["a","b"],"fixed",splits));
  }
  assert.throws(()=>expenseSplits(new Decimal(10),[],"equal"));
  assert.throws(()=>expenseSplits(new Decimal(10),["a"],"shares",[{memberId:"a",shares:0}]));
});
test("pagination and request schema reject malformed input without losing key epochs",()=>{
  for(const page of ["0","-1","NaN","1.5"]) assert.throws(()=>pagination({page}));
  assert.equal(pagination({limit:"500"}).limit,50);
  assert.equal(schemas.todo.parse({title:"encrypted-text",encrypted:true,nonce:"nonce",encryptionEpoch:12}).encryptionEpoch,12);
  assert.equal(schemas.todo.safeParse({title:123}).success,false);
  assert.equal(schemas.expense.safeParse({title:"x",amount:-1}).success,false);
});
test("create todo rejects foreign household assignments before writing",async()=>{
  session(); stub(prisma.householdMember,"count",async()=>0);
  const write=stub(prisma.todo,"create",async()=>{throw new Error("Must not write")});
  const res=await todos.request("/",req({title:"Test",assigneeIds:["outsider"]}));
  assert.equal(res.status,400); assert.equal(write.mock.callCount(),0);
});
test("encrypted todo writes retain epoch and PATCH completion remains supported",async()=>{
  session();
  let saved:any;
  stub(prisma.todo,"create",async({data}:any)=>{saved=data;return {id:"t1",...data}});
  assert.equal((await todos.request("/",req({title:"cipher",encrypted:true,nonce:"n",encryptionEpoch:7}))).status,201);
  assert.equal(saved.encryptionEpoch,7);
  stub(prisma.todo,"findFirst",async()=>({id:"t1"}));
  stub(prisma,"$transaction",async(fn:any)=>fn(prisma));
  stub(prisma.todo,"update",async({data}:any)=>{saved=data;return {id:"t1",...data}});
  assert.equal((await todos.request("/t1",req({completed:true},"PATCH"))).status,200);
  assert.equal(saved.completed,true); assert.equal(saved.encryptionEpoch,undefined);
});
test("custom event PATCH/DELETE apply the same visibility filter as reads",async()=>{
  session();
  stub(prisma.event,"findFirst",async({where}:any)=>{assert.deepEqual(where.OR,visibleEventsWhere("u1").OR);return null});
  for(const method of ["PATCH","DELETE"]) assert.equal((await events.request("/private",req({},method))).status,404);
});
test("deletion vote cannot approve or cancel another household request",async()=>{
  session(); stub(prisma.householdDeletionRequest,"findUnique",async()=>({id:"d1",householdId:"other"}));
  for(const approve of [true,false]) assert.equal((await deletion.request("/vote",req({deletionRequestId:"d1",approve}))).status,404);
  assert.equal((await deletion.request("/vote",req({deletionRequestId:"d1",approve:"false"}))).status,400);
});
test("legacy invitation bypass is disabled and non-owner cannot revoke",async()=>{
  session();
  assert.equal((await invitations.request("/accept",req({code:"test"}))).status,410);
  assert.equal((await invitations.request("/revoke",req({invitationId:"i1"}))).status,403);
});
test("unsigned Stripe purchase never grants an entitlement",async()=>{
  const write=stub(prisma.userSubscription,"upsert",async()=>{throw new Error("Must not write")});
  const res=await webhooks.request("/stripe",req({type:"checkout.session.completed",data:{object:{metadata:{userId:"u1"}}}}));
  assert.ok([400,503].includes(res.status)); assert.equal(write.mock.callCount(),0);
});
test("expense amount edits atomically update the stored splits",async()=>{
  session();
  stub(prisma.expense,"findFirst",async()=>({id:"e1",amount:new Decimal(10),splitType:"equal",splits:[{memberId:"a",amount:new Decimal(5)},{memberId:"b",amount:new Decimal(5)}]}));
  let sum=new Decimal(0);
  const tx={expenseSplit:{updateMany:async({data}:any)=>{sum=sum.add(data.amount)}},expense:{update:async({data}:any)=>({id:"e1",...data})}};
  stub(prisma,"$transaction",async(fn:any)=>fn(tx));
  const res=await expenses.request("/e1",req({amount:15.01},"PATCH"));
  assert.equal(res.status,200); assert.equal(sum.toString(),"15.01");
});
test("departing last owner promotes remaining member and deletes only private records",async()=>{
  const calls:any[]=[];
  const tx:any={todo:{deleteMany:async(a:any)=>calls.push(a)},shoppingItem:{deleteMany:async(a:any)=>calls.push(a)},event:{deleteMany:async(a:any)=>calls.push(a)},householdMember:{findFirst:async(a:any)=>a.where.role?null:{id:"next"},update:async(a:any)=>calls.push(a)}};
  await cleanMemberDeparture(tx,"h1","u1");
  assert.equal(calls[0].where.isPersonal,true); assert.equal(calls[0].where.creatorId,"u1");
  assert.equal(calls[2].where.visibility,"personal"); assert.deepEqual(calls[3],{where:{id:"next"},data:{role:"OWNER"}});
});
test("monthly chores use configured day and recover after short February",()=>{
  const days=getChoreOccurrences({frequency:"monthly",dayOfMonth:31,createdAt:"2026-01-01T12:00:00"},new Date(2026,0,1),new Date(2026,3,1));
  assert.deepEqual(days.map(d=>[d.getMonth(),d.getDate()]),[[0,31],[1,28],[2,31]]);
});


test("allocation preserves every cent over hundreds of totals and household sizes", () => {
  for (let cents=1;cents<300;cents++) for(let size=1;size<=8;size++) {
    const rows=expenseSplits(new Decimal(cents).div(100),Array.from({length:size},(_,i)=>String(i)));
    assert.equal(rows.reduce((sum,row)=>sum.add(row.amount),new Decimal(0)).toFixed(2),new Decimal(cents).div(100).toFixed(2));
    assert.ok(rows.every(row=>row.amount.mul(100).isInteger()));
  }
});

test("expense edits replace split settings and currency in the same transaction",async()=>{
  session();
  stub(prisma.expense,"findFirst",async()=>({id:"e1",amount:new Decimal(10),splitType:"equal",splits:[]}));
  stub(prisma.householdMember,"findMany",async()=>[{id:"a"},{id:"b"}]);
  let created:any, updated:any;
  const tx={expenseSplit:{deleteMany:async()=>{},createMany:async({data}:any)=>{created=data}},expenseLineItem:{deleteMany:async()=>{}},expense:{update:async({data}:any)=>{updated=data;return data}}};
  stub(prisma,"$transaction",async(fn:any)=>fn(tx));
  const res=await expenses.request("/e1",req({amount:20,currency:"USD",splitType:"fixed",splits:[{memberId:"a",amount:7},{memberId:"b",amount:13}]},"PATCH"));
  assert.equal(res.status,200);assert.equal(updated.currency,"USD");assert.equal(updated.splitType,"fixed");assert.deepEqual(created.map((s:any)=>s.amount.toString()),["7","13"]);
});

test("household export scopes personal lists and calendar entries to the requester",async()=>{
  session();
  stub(prisma.householdMember,"findFirst",async()=>({householdId:"h1",household:{name:"Test",baseCurrency:"EUR"}}));
  const captured:Record<string,any>={};
  for(const model of ["householdMember","todo","chore","expense","subscription","event","shoppingItem","mealPlan"] as const) stub(prisma[model],"findMany",async({where}:any)=>{captured[model]=where;return []});
  const {default:households}=await import("../src/routes/households.js");
  assert.equal((await households.request("/export")).status,200);
  assert.deepEqual(captured.todo.OR,[{isPersonal:false},{creatorId:"u1"}]);
  assert.deepEqual(captured.shoppingItem.OR,[{isPersonal:false},{addedBy:"u1"}]);
  assert.deepEqual(captured.event.OR,visibleEventsWhere("u1").OR);
});

test("new account returns an empty household instead of a transport error",async()=>{
  session();stub(prisma.householdMember,"findFirst",async()=>null);
  const {default:members}=await import("../src/routes/members.js");
  const res=await members.request("/list");assert.equal(res.status,200);assert.deepEqual((await res.json()).members,[]);
});
