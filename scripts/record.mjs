// Baixa o resultado oficial do TSE (Brasil, Presidente, 2º turno) e acrescenta um ponto
// em data/historico.json quando o horário de geração (dg+hg) mudou. Sem dependências.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";

const URL = "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json";
const FILE = "data/historico.json";
const toNum = s => { if (s == null || s === "") return NaN; s = String(s).trim(); if (s.includes(",")) s = s.replace(/\./g, "").replace(",", "."); return parseFloat(s); };

function collectCands(obj, out, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 6) return out;
  if (Array.isArray(obj)) { obj.forEach(x => collectCands(x, out, depth + 1)); return out; }
  if (Array.isArray(obj.cand)) obj.cand.forEach(c => out.push(c));
  for (const k of ["carg", "agr", "par"]) if (obj[k]) collectCands(obj[k], out, depth + 1);
  return out;
}

const res = await fetch(URL, { headers: { "user-agent": "apuracao-2026-historico (github action)" } });
if (!res.ok) { console.error("TSE respondeu", res.status); process.exit(0); }
const j = await res.json();
const s = j.s || {}, v = j.v || {};
const ts = toNum(s.ts), st = toNum(s.st);
if (!(st > 0)) { console.log("0 seções totalizadas; nada a gravar"); process.exit(0); }
const cands = collectCands(j, []).map(c => ({ n: String(c.n), nm: c.nmu || c.nm, vap: toNum(c.vap) })).filter(c => !isNaN(c.vap));
const vv = toNum(v.vv) > 0 ? toNum(v.vv) : cands.reduce((a, c) => a + c.vap, 0);
const key = `${j.dg} ${j.hg}`;

const db = existsSync(FILE) ? JSON.parse(readFileSync(FILE, "utf8")) : { eleicao: "6258", abr: "br", fonte: URL, pontos: [] };
const last = db.pontos[db.pontos.length - 1];
if (last && last.k === key) { console.log("sem mudança desde", key); process.exit(0); }

const c = {}; cands.forEach(x => c[x.n] = { vap: x.vap, pct: +(x.vap / vv * 100).toFixed(3), nm: x.nm });
db.pontos.push({ k: key, dg: j.dg, hg: j.hg, pst: +(st / ts * 100).toFixed(2), st, at: Date.now(), c, and: j.and, md: j.md });
db.pontos.sort((a, b) => a.st - b.st);
mkdirSync("data", { recursive: true });
writeFileSync(FILE, JSON.stringify(db));
console.log("gravado", key, `${(st / ts * 100).toFixed(2)}%`, cands.map(x => `${x.nm} ${(x.vap / vv * 100).toFixed(2)}%`).join(" · "));
