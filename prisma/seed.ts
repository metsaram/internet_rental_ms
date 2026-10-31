/**
 * Repeatable seed data for the Internet Rental Management System.
 * Run with: bun run db:seed  (or: bunx tsx prisma/seed.ts)
 *
 * Idempotent: re-running upserts the demo company/users and a realistic
 * set of branches, shops, providers, plans, services and contracts.
 */
import { PrismaClient, UserRole, Prisma } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

function daysFromNow(d: number): Date {
  const t = new Date();
  t.setDate(t.getDate() + d);
  t.setHours(0, 0, 0, 0);
  return t;
}
function monthsAgo(m: number): Date {
  const t = new Date();
  t.setMonth(t.getMonth() - m);
  t.setHours(0, 0, 0, 0);
  return t;
}
function monthsFromNow(m: number): Date {
  const t = new Date();
  t.setMonth(t.getMonth() + m);
  t.setHours(0, 0, 0, 0);
  return t;
}

async function main() {
  const company = await prisma.company.upsert({
    where: { code: "ACME" },
    update: { currency: "USD" },
    create: {
      code: "ACME",
      name: "Acme Retail Holdings",
      taxId: "0105556000000",
      address: "1 Rama IX Rd, Huai Khwang",
      city: "Bangkok",
      phone: "+66 2 123 4567",
      email: "ops@acme.example",
      currency: "USD",
      status: "ACTIVE",
    },
  });

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@netrent.local";
  const staffEmail = process.env.SEED_STAFF_EMAIL ?? "staff@netrent.local";

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Site Admin",
      passwordHash: hashPassword(process.env.SEED_ADMIN_PASSWORD ?? "admin12345"),
      role: UserRole.ADMIN,
      companyId: company.id,
      status: "ACTIVE",
    },
  });

  const staff = await prisma.user.upsert({
    where: { email: staffEmail },
    update: {},
    create: {
      email: staffEmail,
      name: "Floor Staff",
      passwordHash: hashPassword(process.env.SEED_STAFF_PASSWORD ?? "staff12345"),
      role: UserRole.STAFF,
      companyId: company.id,
      status: "ACTIVE",
    },
  });

  // Branches ---------------------------------------------------------------
  const branches = await Promise.all(
    [
      { code: "BKK-01", name: "Sukhumvit Flagship", city: "Bangkok", manager: "N. Chai", phone: "+66 81 111 1111" },
      { code: "BKK-02", name: "Silom Downtown", city: "Bangkok", manager: "P. Saen", phone: "+66 81 222 2222" },
      { code: "CNX-01", name: "Chiang Mai Nimman", city: "Chiang Mai", manager: "K. Pim", phone: "+66 81 333 3333" },
      { code: "HKT-01", name: "Phuket Patong", city: "Phuket", manager: "S. Lek", phone: "+66 81 444 4444" },
    ].map((b) =>
      prisma.branch.upsert({
        where: { companyId_code: { companyId: company.id, code: b.code } },
        update: { name: b.name, city: b.city, manager: b.manager, phone: b.phone },
        create: { companyId: company.id, ...b, address: `${b.name}, ${b.city}`, status: "ACTIVE" },
      })
    )
  );

  // Shops ------------------------------------------------------------------
  const shopDefs: Array<{ branchIdx: number; code: string; name: string; type: any }> = [
    { branchIdx: 0, code: "SUK-A1", name: "Shop A1 - Electronics", type: "GARAGE" },
    { branchIdx: 0, code: "SUK-B2", name: "Kiosk B2 - Coffee", type: "KIOSK" },
    { branchIdx: 1, code: "SIL-01", name: "Office 01 - Finance", type: "OFFICE" },
    { branchIdx: 1, code: "SIL-02", name: "Restaurant 02", type: "RESTAURANT" },
    { branchIdx: 2, code: "CNX-01", name: "Shop 01 - Fashion", type: "GARAGE" },
    { branchIdx: 3, code: "HKT-01", name: "Shop 01 - Souvenirs", type: "GARAGE" },
  ];
  const shops = await Promise.all(
    shopDefs.map((s) =>
      prisma.shop.upsert({
        where: { companyId_code: { companyId: company.id, code: s.code } },
        update: { branchId: branches[s.branchIdx].id, name: s.name, type: s.type },
        create: {
          companyId: company.id,
          branchId: branches[s.branchIdx].id,
          code: s.code,
          name: s.name,
          type: s.type,
          contactPerson: "Counter staff",
          phone: branches[s.branchIdx].phone,
          status: "ACTIVE",
        },
      })
    )
  );

  // Providers --------------------------------------------------------------
  const providers = await Promise.all(
    [
      { code: "AIS-FIBER", name: "AIS Fibre", contactPerson: "AIS Biz", phone: "+66 2 571 2000", email: "biz@ais.example", website: "https://ais.example" },
      { code: "TRUE", name: "True Internet", contactPerson: "True Biz", phone: "+66 2 700 8000", email: "biz@true.example", website: "https://true.example" },
      { code: "3BB", name: "3BB Broadband", contactPerson: "3BB Sales", phone: "+66 2 100 2000", email: "sales@3bb.example", website: "https://3bb.example" },
      { code: "TOT", name: "TOT Plc", contactPerson: "TOT Enterprise", phone: "+66 2 537 0000", email: "ent@tot.example", website: "https://tot.example" },
    ].map((p) =>
      prisma.internetProvider.upsert({
        where: { companyId_code: { companyId: company.id, code: p.code } },
        update: {},
        create: { companyId: company.id, ...p, status: "ACTIVE" },
      })
    )
  );

  // Plans ------------------------------------------------------------------
  const planDefs: Array<{ pIdx: number; name: string; down: number; up: number; type: any; price: number; desc?: string }> = [
    { pIdx: 0, name: "Home 300/100", down: 300, up: 100, type: "FIBER", price: 790, desc: "Residential fibre 300/100" },
    { pIdx: 0, name: "Biz 500/500", down: 500, up: 500, type: "FIBER", price: 1290, desc: "Symmetric business fibre" },
    { pIdx: 0, name: "Biz 1000/1000", down: 1000, up: 1000, type: "FIBER", price: 2490, desc: "1 Gbps symmetric business" },
    { pIdx: 1, name: "True 600/150", down: 600, up: 150, type: "FIBER", price: 890 },
    { pIdx: 1, name: "True Biz 1000/500", down: 1000, up: 500, type: "FIBER", price: 2190 },
    { pIdx: 2, name: "3BB 200/50", down: 200, up: 50, type: "FIBER", price: 590 },
    { pIdx: 3, name: "TOT Wireless 50/10", down: 50, up: 10, type: "WIRELESS", price: 690 },
  ];
  const plans = await Promise.all(
    planDefs.map((p) =>
      prisma.internetPlan.upsert({
        where: { companyId_providerId_name: { companyId: company.id, providerId: providers[p.pIdx].id, name: p.name } },
        update: { currency: "USD" },
        create: {
          companyId: company.id,
          providerId: providers[p.pIdx].id,
          name: p.name,
          bandwidthDownMbps: p.down,
          bandwidthUpMbps: p.up,
          connectionType: p.type,
          catalogMonthlyPrice: new Prisma.Decimal(p.price),
          currency: "USD",
          status: "ACTIVE",
          description: p.desc ?? null,
        },
      })
    )
  );

  // Services ---------------------------------------------------------------
  const serviceDefs: Array<{ branchIdx: number; shopIdx?: number; pIdx: number; planIdx: number; code: string; acct: string; cid?: string; sid?: string; addr: string; ip?: string; ipType?: any; user?: string; status?: any; circuitRole?: any }> = [
    { branchIdx: 0, shopIdx: 0, pIdx: 0, planIdx: 0, code: "SVC-0001", acct: "AIS-100001", cid: "CID-AIS-9001", sid: "SID-880191", addr: "Sukhumvit, Shop A1", ip: "10.0.1.5", ipType: "STATIC", user: "ais_user_001", status: "ACTIVE", circuitRole: "PRIMARY" },
    { branchIdx: 0, shopIdx: 1, pIdx: 0, planIdx: 1, code: "SVC-0002", acct: "AIS-100002", cid: "CID-AIS-9002", sid: "SID-880192", addr: "Sukhumvit, Kiosk B2", ip: "10.0.1.6", ipType: "STATIC", user: "ais_user_002", status: "ACTIVE", circuitRole: "STANDALONE" },
    { branchIdx: 1, shopIdx: 2, pIdx: 1, planIdx: 3, code: "SVC-0003", acct: "TRUE-200001", cid: "CID-TRUE-7001", sid: "SID-441201", addr: "Silom, Office 01", ip: "10.0.2.5", ipType: "STATIC", user: "true_user_001", status: "ACTIVE", circuitRole: "PRIMARY" },
    { branchIdx: 1, shopIdx: 3, pIdx: 1, planIdx: 4, code: "SVC-0004", acct: "TRUE-200002", cid: "CID-TRUE-7002", sid: "SID-441202", addr: "Silom, Restaurant 02", ipType: "DYNAMIC", status: "ACTIVE", circuitRole: "STANDALONE" },
    { branchIdx: 2, shopIdx: 4, pIdx: 2, planIdx: 5, code: "SVC-0005", acct: "3BB-300001", cid: "CID-3BB-5001", sid: "SID-772911", addr: "Nimman, Shop 01", ipType: "DYNAMIC", status: "ACTIVE", circuitRole: "STANDALONE" },
    { branchIdx: 3, shopIdx: 5, pIdx: 3, planIdx: 6, code: "SVC-0006", acct: "TOT-400001", cid: "CID-NT-3001", sid: "SID-220910", addr: "Patong, Shop 01", ipType: "CGNAT", status: "ACTIVE", circuitRole: "STANDALONE" },
    // a branch-only service (no shop) — primary backbone
    { branchIdx: 0, pIdx: 0, planIdx: 2, code: "SVC-0007", acct: "AIS-100007", cid: "CID-AIS-9007", sid: "SID-880197", addr: "Sukhumvit, Branch backbone", ip: "10.0.1.1", ipType: "STATIC", user: "ais_admin_007", status: "ACTIVE", circuitRole: "PRIMARY" },
    // backup line (suspended) for Silom — provides redundancy for SVC-0003
    { branchIdx: 1, pIdx: 2, planIdx: 5, code: "SVC-0008", acct: "3BB-300008", cid: "CID-3BB-5008", sid: "SID-772918", addr: "Silom, backup line", ipType: "DYNAMIC", status: "SUSPENDED", circuitRole: "BACKUP" },
  ];
  const services = await Promise.all(
    serviceDefs.map((s) =>
      prisma.internetService.upsert({
        where: { companyId_serviceCode: { companyId: company.id, serviceCode: s.code } },
        update: {
          customerId: s.cid ?? null,
          ispServiceId: s.sid ?? null,
        },
        create: {
          companyId: company.id,
          branchId: branches[s.branchIdx].id,
          shopId: s.shopIdx !== undefined ? shops[s.shopIdx].id : null,
          providerId: providers[s.pIdx].id,
          planId: plans[s.planIdx].id,
          serviceCode: s.code,
          accountId: s.acct,
          customerId: s.cid ?? null,
          ispServiceId: s.sid ?? null,
          installationAddress: s.addr,
          ipAddress: s.ip ?? null,
          ipType: s.ipType ?? "DYNAMIC",
          username: s.user ?? null,
          status: s.status ?? "PENDING",
          circuitRole: s.circuitRole ?? "STANDALONE",
          installedAt: monthsAgo(6),
        },
      })
    )
  );

  // Contracts -------------------------------------------------------------
  // A mix: active, expiring soon, expired, upcoming. Some services get a
  // renewed (second) contract period to demonstrate history preservation.
  const contractDefs: Array<{ sIdx: number; num: string; startMonthsAgo: number; duration: number; free: number; fee: number; cycle?: any; status?: any }> = [
    { sIdx: 0, num: "CT-2024-001", startMonthsAgo: 6, duration: 12, free: 1, fee: 790, cycle: "MONTHLY", status: "ACTIVE" },
    { sIdx: 1, num: "CT-2024-002", startMonthsAgo: 4, duration: 12, free: 0, fee: 1290, cycle: "MONTHLY", status: "ACTIVE" },
    { sIdx: 2, num: "CT-2024-003", startMonthsAgo: 10, duration: 12, free: 2, fee: 890, cycle: "MONTHLY", status: "ACTIVE" },
    // expiring soon (started 11 months ago, 12-month term → 1 month left)
    { sIdx: 3, num: "CT-2024-004", startMonthsAgo: 11, duration: 12, free: 0, fee: 2190, cycle: "MONTHLY", status: "ACTIVE" },
    // expired (15 months ago, 12-month term)
    { sIdx: 4, num: "CT-2023-005", startMonthsAgo: 15, duration: 12, free: 0, fee: 590, cycle: "MONTHLY", status: "EXPIRED" },
    // renewed history: old expired contract + new active contract on same service
    { sIdx: 5, num: "CT-2023-006", startMonthsAgo: 14, duration: 12, free: 0, fee: 690, cycle: "MONTHLY", status: "EXPIRED" },
    { sIdx: 5, num: "CT-2024-006R", startMonthsAgo: 2, duration: 12, free: 1, fee: 750, cycle: "MONTHLY", status: "ACTIVE" },
    // upcoming contract
    { sIdx: 6, num: "CT-2025-007", startMonthsAgo: -1, duration: 24, free: 3, fee: 2490, cycle: "MONTHLY", status: "DRAFT" },
    // suspended service, active contract term
    { sIdx: 7, num: "CT-2024-008", startMonthsAgo: 5, duration: 6, free: 0, fee: 590, cycle: "MONTHLY", status: "TERMINATED" },
  ];
  const contracts = await Promise.all(
    contractDefs.map(async (c) => {
      const start = monthsAgo(c.startMonthsAgo);
      const end = new Date(start);
      end.setMonth(end.getMonth() + c.duration);
      return prisma.internetContract.upsert({
        where: { companyId_contractNumber: { companyId: company.id, contractNumber: c.num } },
        update: { currency: "USD" },
        create: {
          companyId: company.id,
          serviceId: services[c.sIdx].id,
          contractNumber: c.num,
          startDate: start,
          endDate: end,
          durationMonths: c.duration,
          freeMonths: c.free,
          monthlyFee: new Prisma.Decimal(c.fee),
          currency: "USD",
          billingCycle: c.cycle ?? "MONTHLY",
          status: c.status ?? "DRAFT",
          createdById: admin.id,
          notes: "Seeded demo contract",
        },
      });
    })
  );

  // Contract renewals (Phase 13) -------------------------------------------
  // Link the renewed pair: old CT-2023-006 (expired) → new CT-2024-006R (active).
  const oldRenewed = contracts.find((c) => c.contractNumber === "CT-2023-006")!;
  const newRenewed = contracts.find((c) => c.contractNumber === "CT-2024-006R")!;
  await prisma.contractRenewal.upsert({
    where: { oldContractId: oldRenewed.id },
    update: { newCurrency: "USD" },
    create: {
      companyId: company.id,
      oldContractId: oldRenewed.id,
      newContractId: newRenewed.id,
      serviceId: oldRenewed.serviceId,
      decisionDate: newRenewed.startDate,
      decidedById: admin.id,
      status: "COMPLETED",
      warningDate: monthsAgo(3),
      noticeDate: monthsAgo(2),
      newStartDate: newRenewed.startDate,
      newEndDate: newRenewed.endDate,
      newMonthlyFee: newRenewed.monthlyFee,
      newCurrency: newRenewed.currency,
      newDurationMonths: newRenewed.durationMonths,
      newFreeMonths: newRenewed.freeMonths,
      notes: "Seed: completed renewal (old $690 → new $750, added 1 free month).",
      createdById: admin.id,
    },
  });

  // A pending renewal on CT-2024-004 (expiring soon — 1 month left) to show in
  // the "Upcoming" tab.
  const expiring = contracts.find((c) => c.contractNumber === "CT-2024-004")!;
  await prisma.contractRenewal.upsert({
    where: { oldContractId: expiring.id },
    update: {},
    create: {
      id: "seed-renewal-pending-004",
      companyId: company.id,
      oldContractId: expiring.id,
      newContractId: null,
      serviceId: expiring.serviceId,
      status: "PENDING",
      warningDate: new Date(),
      noticeDate: monthsFromNow(0),
      notes: "Seed: pending renewal awaiting decision (contract ends in ~30 days).",
      createdById: admin.id,
    },
  });

  // A few shop notes -------------------------------------------------------
  await prisma.note.upsert({
    where: { id: "seed-note-1" },
    update: {},
    create: {
      id: "seed-note-1",
      companyId: company.id,
      shopId: shops[0].id,
      authorId: admin.id,
      body: "Counter POS now connected over the new fibre line. Speeds look good.",
    },
  });
  await prisma.note.upsert({
    where: { id: "seed-note-2" },
    update: {},
    create: {
      id: "seed-note-2",
      companyId: company.id,
      shopId: shops[2].id,
      authorId: staff.id,
      body: "Reported intermittent drops on True line — opened ticket #T-9912.",
    },
  });

  // Invoices, payments & allocations (Phase 12) --------------------------
  // Active contracts (the billable ones) by index in contractDefs:
  // 0:CT-2024-001(790), 1:CT-2024-002(1290), 2:CT-2024-003(890),
  // 3:CT-2024-004(2190), 5:CT-2024-006R(750)
  const invoiceDefs: Array<{
    id: string;
    num: string;
    contractNum: string;
    monthsAgo: number;
    periodMonths: number;
    tax: number;
    status: "DRAFT" | "ISSUED" | "PAID" | "OVERDUE" | "PARTIAL";
    dueOffsetDays: number;
  }> = [
    // fully paid invoice (1 month, CT-2024-001, 790 + 7% VAT)
    { id: "seed-inv-1", num: "INV-2024-001", contractNum: "CT-2024-001", monthsAgo: 5, periodMonths: 1, tax: 55.3, status: "PAID", dueOffsetDays: 30 },
    // issued + overdue (CT-2024-002, 1290) — past due, unpaid
    { id: "seed-inv-2", num: "INV-2024-002", contractNum: "CT-2024-002", monthsAgo: 2, periodMonths: 1, tax: 90.3, status: "OVERDUE", dueOffsetDays: 15 },
    // partial payment (CT-2024-003, 890) — half paid
    { id: "seed-inv-3", num: "INV-2024-003", contractNum: "CT-2024-003", monthsAgo: 1, periodMonths: 1, tax: 62.3, status: "PARTIAL", dueOffsetDays: 30 },
    // issued, not yet due (CT-2024-004, 2190)
    { id: "seed-inv-4", num: "INV-2024-004", contractNum: "CT-2024-004", monthsAgo: 0, periodMonths: 1, tax: 153.3, status: "ISSUED", dueOffsetDays: 30 },
    // draft (CT-2024-006R, 750)
    { id: "seed-inv-5", num: "INV-2024-005", contractNum: "CT-2024-006R", monthsAgo: 0, periodMonths: 1, tax: 52.5, status: "DRAFT", dueOffsetDays: 30 },
  ];

  const invoices = await Promise.all(
    invoiceDefs.map(async (inv) => {
      const contract = contracts.find((c) => c.contractNumber === inv.contractNum)!;
      const subtotal = Number(contract.monthlyFee) * inv.periodMonths;
      const total = subtotal + inv.tax;
      const invoiceDate = monthsAgo(inv.monthsAgo);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + inv.dueOffsetDays);
      const periodStart = new Date(invoiceDate);
      const periodEnd = new Date(invoiceDate);
      periodEnd.setMonth(periodEnd.getMonth() + inv.periodMonths);
      return prisma.invoice.upsert({
        where: { id: inv.id },
        update: { currency: "USD" },
        create: {
          id: inv.id,
          companyId: company.id,
          contractId: contract.id,
          invoiceNumber: inv.num,
          invoiceDate,
          periodStart,
          periodEnd,
          subtotal: new Prisma.Decimal(subtotal),
          tax: new Prisma.Decimal(inv.tax),
          discount: new Prisma.Decimal(0),
          total: new Prisma.Decimal(total),
          currency: "USD",
          status: inv.status,
          dueDate,
          notes: "Seeded demo invoice",
          createdById: admin.id,
        },
      });
    })
  );

  // Payments + allocations
  const inv1 = invoices[0]; // paid in full
  const inv3 = invoices[2]; // partial
  const payment1Total = Number(inv1.total);
  const payment3Partial = Math.round(Number(inv3.total) / 2); // half

  await prisma.payment.upsert({
    where: { id: "seed-pay-1" },
    update: { currency: "USD" },
    create: {
      id: "seed-pay-1",
      companyId: company.id,
      paymentDate: monthsAgo(4),
      amount: new Prisma.Decimal(payment1Total),
      currency: "USD",
      method: "BANK_TRANSFER",
      reference: "BANK-TR-0001",
      status: "COMPLETED",
      notes: "Full payment for INV-2024-001",
      createdById: staff.id,
    },
  });
  await prisma.paymentAllocation.upsert({
    where: { paymentId_invoiceId: { paymentId: "seed-pay-1", invoiceId: inv1.id } },
    update: {},
    create: {
      paymentId: "seed-pay-1",
      invoiceId: inv1.id,
      amount: new Prisma.Decimal(payment1Total),
    },
  });

  await prisma.payment.upsert({
    where: { id: "seed-pay-2" },
    update: { currency: "USD" },
    create: {
      id: "seed-pay-2",
      companyId: company.id,
      paymentDate: monthsAgo(0),
      amount: new Prisma.Decimal(payment3Partial),
      currency: "USD",
      method: "CARD",
      reference: "CARD-0002",
      status: "COMPLETED",
      notes: "Partial payment for INV-2024-003",
      createdById: staff.id,
    },
  });
  await prisma.paymentAllocation.upsert({
    where: { paymentId_invoiceId: { paymentId: "seed-pay-2", invoiceId: inv3.id } },
    update: {},
    create: {
      paymentId: "seed-pay-2",
      invoiceId: inv3.id,
      amount: new Prisma.Decimal(payment3Partial),
    },
  });

  // Outage incidents (Phase 6) ----------------------------------------------
  // A resolved outage on SVC-0001 (3 hours downtime last month)
  const svc1 = services.find((s) => s.serviceCode === "SVC-0001")!;
  const svc3 = services.find((s) => s.serviceCode === "SVC-0003")!;
  const outageStart = monthsAgo(1);
  outageStart.setHours(outageStart.getHours() + 10); // mid-day
  const outageEnd = new Date(outageStart);
  outageEnd.setHours(outageEnd.getHours() + 3); // 3 hours later

  await prisma.outageIncident.upsert({
    where: { id: "seed-outage-1" },
    update: {},
    create: {
      id: "seed-outage-1",
      companyId: company.id,
      serviceId: svc1.id,
      type: "OUTAGE",
      status: "RESOLVED",
      startTime: outageStart,
      endTime: outageEnd,
      downtimeMinutes: 180,
      notes: "Complete loss of connectivity. AIS technician dispatched, fiber splice repaired.",
      reportedById: staff.id,
      resolvedById: admin.id,
    },
  });

  // An ongoing degraded incident on SVC-0003
  const ongoingStart = new Date();
  ongoingStart.setHours(ongoingStart.getHours() - 2); // 2 hours ago
  await prisma.outageIncident.upsert({
    where: { id: "seed-outage-2" },
    update: {},
    create: {
      id: "seed-outage-2",
      companyId: company.id,
      serviceId: svc3.id,
      type: "DEGRADED",
      status: "ONGOING",
      startTime: ongoingStart,
      notes: "Degraded throughput (reported ~20% of expected bandwidth). True ticket #T-5521 open.",
      reportedById: staff.id,
    },
  });

  console.log("Seed complete ✔");
  console.log("  Company:", company.code, company.name);
  console.log("  Admin:  ", adminEmail, "(password: admin12345)");
  console.log("  Staff:  ", staffEmail, "(password: staff12345)");
  console.log("  Branches:", branches.length, "| Shops:", shops.length, "| Providers:", providers.length, "| Plans:", plans.length, "| Services:", services.length, "| Contracts:", contracts.length, "| Invoices:", invoices.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
