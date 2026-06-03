// src/seed.js — populate Neon/Postgres with demo doctors (run: npm run seed)
import bcrypt from 'bcryptjs';
import { query, initSchema } from './db.js';

const demo = [
  ['aisha@demo.dev','Dr. Aisha Rahman','Female','United Kingdom','UTC+0','PLAB','PLAB 1 / AKT','3–6 Months In','2026-11-15','IMG preparing for PLAB 1. Daily rapid-fire question partners welcome.'],
  ['james@demo.dev','Dr. James Okafor','Male','United States','UTC-5','USMLE','Step 1','1–3 Months In','2026-09-20','USMLE Step 1. Strong in pathology and pharm.'],
  ['zainab@demo.dev','Dr. Zainab Malik','Female','Pakistan','UTC+5','FCPS-Medicine','Part 1','3–6 Months In','2026-08-10','FCPS Part 1 Medicine using OHCM. Prefer female partners.'],
  ['fatima@demo.dev','Dr. Fatima Sheikh','Female','Pakistan','UTC+5','FCPS-GynaeObs','Part 2','3–6 Months In','2026-10-05','FCPS Gynae & Obs Part 2. Case discussions and TOACS practice.'],
  ['imran@demo.dev','Dr. Imran Khan','Male','Pakistan','UTC+5','FCPS-Paeds','Part 1','1–3 Months In','2026-11-20','FCPS Paediatrics Part 1. Want help with basic sciences.'],
  ['hira@demo.dev','Dr. Hira Bukhari','Female','Pakistan','UTC+5','FCPS-Pathology','Part 1','Just Started','2027-03-01','FCPS Pathology, histopathology focus. Slow-and-steady partner.'],
  ['nadia@demo.dev','Dr. Nadia Hussain','Female','Pakistan','UTC+5','FCPS-Ophthalmology','Part 1','1–3 Months In','2026-12-15','FCPS Ophthalmology Part 1. Drill optics and ocular anatomy.'],
  ['daniyal@demo.dev','Dr. Daniyal Raza','Male','Pakistan','UTC+5','FCPS-ENT','Part 2','6+ Months / Polishing','2026-08-25','FCPS ENT Part 2. Viva-style rapid questioning.'],
  ['sophie@demo.dev','Dr. Sophie Brennan','Female','United Kingdom','UTC+0','MRCPCH','FOP','1–3 Months In','2026-10-18','MRCPCH FOP. Basic sciences and applied physiology.'],
  ['aoife@demo.dev','Dr. Aoife Murphy','Female','Ireland','UTC+0','MRCOG','Part 2','3–6 Months In','2026-09-28','MRCOG Part 2 EMQs/SBAs. Green-top guidelines.'],
  ['kwame@demo.dev','Dr. Kwame Mensah','Male','Ghana','UTC+0','MRCGP','AKT','1–3 Months In','2026-11-02','MRCGP AKT. Spaced-repetition and weekly check-ins.'],
  ['lena@demo.dev','Dr. Lena Vogel','Female','Germany','UTC+1','MRCPsych','Paper A','Just Started','2027-01-25','MRCPsych Paper A. Psychopharmacology and neurosciences.'],
  ['rohan@demo.dev','Dr. Rohan Mehta','Male','India','UTC+5','MRCPath','Part 1','3–6 Months In','2026-10-12','MRCPath Part 1 histopath. Swap slide reviews.'],
];

const hash = bcrypt.hashSync('password123', 10);

async function run() {
  await initSchema();
  let n = 0;
  for (const [email, name, gender, country, tz, exam, step, level, date, bio] of demo) {
    const r = await query(
      `INSERT INTO users (email,password_hash,name,gender,country,timezone,exam,step,level,exam_date,bio,verified)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,1)
       ON CONFLICT (email) DO NOTHING`,
      [email, hash, name, gender, country, tz, exam, step, level, date, bio]
    );
    n += r.rowCount;
  }
  console.log(`Seeded ${n} doctors (login: any seed email / password123).`);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
