# Manual Verification — skillset v0.2.0

Lakukan setelah install (restart sesi). Centang bila lulus.

## Unit & struktur
- [ ] `node --test tests/*.test.mjs` → semua PASS (lib, scan, sync, query, doctor, hook)
- [ ] `claude plugin validate /config/workspace/ai/skillset` → lulus
- [ ] `node scripts/scan.mjs --data-dir /tmp/skillset-smoke --plugins-file tests/fixtures/installed.json` → katalog tergenerate di /tmp/skillset-smoke
- [ ] `node scripts/scan.mjs --check --data-dir /tmp/skillset-smoke --plugins-file tests/fixtures/installed.json` → exit 0; ubah versi fixture → exit 1
- [ ] (setelah `/skillset:init`) `node scripts/sync.mjs --dry-run` → exit 0, `dryRunCommands` tercetak, tanpa spawn nyata
- [ ] `mkdir -p /tmp/skillset-smoke-bad && printf '{bad' > /tmp/skillset-smoke-bad/manifest.json && node scripts/sync.mjs --data-dir /tmp/skillset-smoke-bad` → exit 2, pesan berisi `manifest.json tidak valid` (bukan `sync gagal`) — dir terpisah agar cek lain tetap idempoten
- [ ] `mkdir -p /tmp/skillset-smoke-fail && printf '{"autoUpdate":true,"plugins":["nonexistent-plugin@nowhere"]}' > /tmp/skillset-smoke-fail/manifest.json && node scripts/sync.mjs --data-dir /tmp/skillset-smoke-fail --plugins-file tests/fixtures/installed.json` → **exit 0** walaupun `failed` berisi entri (non-blocking terverifikasi)

## /skillset:init (end-to-end, menyentuh home asli — memang tujuan plugin)
- [ ] `/skillset:init` → manifest tergenerate berisi plugin user-scope saat ini; `~/.claude/skillset/data/catalog.md` ada dan memuat superpowers dkk.
- [ ] Plugin gagal update (bila ada) dilaporkan, workflow tetap selesai
- [ ] `rules.md` terbentuk dari template; jalankan ulang `/skillset:init` → rules TIDAK tertimpa

## /skillset:catalog & query
- [ ] `/skillset:catalog` → ringkasan per plugin
- [ ] `/skillset:catalog tdd` → hasil query ber-prefix plugin

## Router
- [ ] `/skillset:make tambah tombol export CSV di dashboard` → pre-flight jalan; usulan rantai tampil (brainstorming…verification); TIDAK eksekusi apa pun sebelum konfirmasi
- [ ] Task trivial (pertanyaan kecil nyata) → router menjawab langsung tanpa rantai

## Drift
- [ ] Jalankan `claude plugin update superpowers`, lalu `node scripts/scan.mjs --check` → exit 1 (drift terdeteksi); lalu jalankan `/skillset:update` (atau `node scripts/scan.mjs`) agar katalog segar kembali

## Doctor & hook SessionStart
- [ ] `node scripts/doctor.mjs` di data nyata → exit 0 atau 1 dengan tiap check terbaca (catalog/drift/manifest/rules/duplicates/skillset-src)
- [ ] `node hooks/session-start.mjs` manual → keluar tanpa output saat katalog fresh
- [ ] Ubah satu versi di `~/.claude/skillset/data/catalog.json` → `node hooks/session-start.mjs` mencetak 1 baris saran `/skillset:update`; kembalikan versi katalog seperti semula

## Clean-up fixture
- [ ] Kembalikan fixture: `git checkout -- tests/fixtures/installed.json`
- [ ] `rm -rf /tmp/skillset-smoke /tmp/skillset-smoke-bad /tmp/skillset-smoke-fail`
