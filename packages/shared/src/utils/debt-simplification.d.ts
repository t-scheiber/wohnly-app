/**
 * Debt simplification algorithm — minimizes the number of transactions
 * needed to settle all balances in a group.
 *
 * Uses a greedy approach: repeatedly match the largest creditor with the
 * largest debtor until all balances are zero.
 */
export interface MemberDebt {
    memberId: string;
    balance: number;
}
export interface Settlement {
    from: string;
    to: string;
    amount: number;
}
export declare function simplifyDebts(balances: MemberDebt[]): Settlement[];
