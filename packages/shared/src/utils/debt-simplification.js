/**
 * Debt simplification algorithm — minimizes the number of transactions
 * needed to settle all balances in a group.
 *
 * Uses a greedy approach: repeatedly match the largest creditor with the
 * largest debtor until all balances are zero.
 */
export function simplifyDebts(balances) {
    // Create mutable copy, filter out zero balances
    const nets = balances
        .map((b) => ({ memberId: b.memberId, balance: Math.round(b.balance * 100) / 100 }))
        .filter((b) => Math.abs(b.balance) > 0.01);
    const settlements = [];
    while (true) {
        // Sort: debtors (most negative first), creditors (most positive first)
        nets.sort((a, b) => a.balance - b.balance);
        const debtor = nets[0]; // most negative
        const creditor = nets[nets.length - 1]; // most positive
        if (!debtor || !creditor || debtor.balance >= -0.01 || creditor.balance <= 0.01) {
            break;
        }
        // Transfer the smaller of the two absolute values
        const amount = Math.min(-debtor.balance, creditor.balance);
        const rounded = Math.round(amount * 100) / 100;
        if (rounded > 0) {
            settlements.push({
                from: debtor.memberId,
                to: creditor.memberId,
                amount: rounded,
            });
        }
        debtor.balance += amount;
        creditor.balance -= amount;
        // Remove settled members
        for (let i = nets.length - 1; i >= 0; i--) {
            if (Math.abs(nets[i].balance) < 0.01)
                nets.splice(i, 1);
        }
    }
    return settlements;
}
//# sourceMappingURL=debt-simplification.js.map