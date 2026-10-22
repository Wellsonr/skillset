---
name: router
description: Prosedur routing bersama semua command router skillset (make/development/plan/execute/review) — pre-flight anti-stale, pemilihan rantai skill lintas plugin, usulan-konfirmasi, eksekusi berantai, penerapan rules.
---

# Prosedur Router Skillset

Command pemanggil memberikan: **archetype** (tabel rantai titik-awal) dan **task**. Ikuti langkah:

1. **Pre-flight anti-stale.** Jalankan `node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs" --check`.
   - Exit 1 dengan `missing-catalog` → tawarkan menjalankan `/skillset:init` dulu; jangan lanjut sebelum user memilih.
   - Exit 1 dengan drift (`added`/`version`/`removed`) → tawarkan `/skillset:update`; user boleh menolak dan lanjut dengan katalog lama.
2. **Deteksi task trivial.** Bila task bukan proyek/workflow (pertanyaan kecil, permintaan satu baris), sampaikan bahwa rantai skill tidak diperlukan, jawab langsung, selesai.
3. **Load selektif.** Jalankan `node "${CLAUDE_PLUGIN_ROOT}/scripts/query.mjs" <keyword domain task>` (WAJIB lewat query — JANGAN membaca `catalog.json`/`catalog.md` penuh). Lalu `Read ~/.claude/skillset/data/rules.md`; bila belum ada → tawarkan `/skillset:init`.
4. **Susun rantai.** Mulai dari archetype command, sesuaikan dengan hasil query (hanya skill yang benar-benar tersedia di katalog). Substitusi dua arah bila skill tak tersedia:
   - `superpowers:test-driven-development` ⇄ `mattpocock-skills:tdd`
   - `pr-review-toolkit:code-reviewer` ⇄ `ecc:code-reviewer`
   - review utama: `mattpocock-skills:code-review` ⇄ `pr-review-toolkit:review-pr`

   Skill tanpa substitusi → usulkan skip dengan catatan.
5. **Tentukan rules aktif.** Section `selalu` selalu aktif; section lain (mis. `web-project`) aktif bila triggernya cocok task. Sebutkan rules yang akan diterapkan.
6. **USULKAN → tunggu konfirmasi eksplisit.** Tampilkan tabel: skill → peran → alasan; rules aktif; file yang akan dibaca. JANGAN eksekusi apa pun sebelum user menyetujui (atau mengubah lalu menyetujui).
7. **Eksekusi berantai.** Invoke skill via Skill tool sesuai urutan. Sebelum tiap fase, cek rules yang relevan fase tersebut. Hormati gate internal tiap skill (mis. approval brainstorming TIDAK di-bypass).
8. **Ringkasan akhir.** Hasil per fase, status penerapan rules (mis. docs mana yang di-update), saran follow-up (`/skillset:review`, `/skillset:update`, dst.).
