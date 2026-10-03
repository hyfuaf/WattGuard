export const PLANS = {
  monthly: { name: '月度会员', price: 19, months: 1 },
  yearly: { name: '年度会员', price: 190, months: 12 }
};

export function membershipActive(user, now = Date.now()) {
  return Boolean(user.subscription_active && user.subscription_until > now);
}

export function membershipEnd(plan, from = Date.now()) {
  const start = new Date(from);
  const end = new Date(from);
  end.setUTCDate(1);
  end.setUTCMonth(end.getUTCMonth() + PLANS[plan].months);
  const lastDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  end.setUTCDate(Math.min(start.getUTCDate(), lastDay));
  return end.getTime();
}

export function publicMembership(user) {
  return {
    active: membershipActive(user),
    plan: user.subscription_plan || null,
    expiresAt: user.subscription_until || null
  };
}
