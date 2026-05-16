# Requirements Document

## Introduction

SpecPilot adalah platform berbasis web untuk mengelola pengembangan perangkat lunak dengan pendekatan *spec-driven development*. SpecPilot mengubah permintaan natural language pengguna menjadi alur kerja terstruktur: Intent → Requirements → Design → Tasks → Execution → Verification → Review → Commit/PR. SpecPilot bukan IDE penuh, melainkan *orchestration layer* yang mengatur spec, desain, task, eksekusi agent CLI, log realtime, diff viewer, approval, dan integrasi Git.

Dokumen ini mendefinisikan kebutuhan MVP SpecPilot sesuai PRD v2.0. Fitur Agent Hooks, Spec Graph, Marketplace Agent, Multi-tenant Enterprise, Collaborative Editing Realtime, Visual Workflow Builder, Deployment Otomatis, Billing, Advanced RBAC, Mobile App Native, dan Spec Categorization (workflow berbeda untuk Feature/Bugfix/Quick Plan seperti yang dimiliki Kiro) dikecualikan dari scope MVP dan ditangguhkan ke Phase 2.

Stack target: Vue 3 + TypeScript (frontend), NestJS + TypeScript + Node.js 20 LTS (backend API), Node.js 20 LTS + BullMQ + PM2 (worker), Redis (queue), MariaDB (database).

## Glossary

- **SpecPilot**: Sistem orchestration berbasis web yang terdiri atas Frontend, Backend_API, Internal_API, Worker, Database, dan Redis_Queue.
- **Frontend**: Aplikasi web Vue 3 yang menyajikan UI kepada User.
- **Backend_API**: Aplikasi NestJS yang menyediakan endpoint publik `/api/*` untuk Frontend dan diakses dengan JWT (Bearer token).
- **Internal_API**: Subset endpoint NestJS di prefix `/internal/*` yang hanya dapat diakses Worker menggunakan header `X-Worker-Secret`.
- **Worker**: Proses Node.js 20 LTS yang dijalankan oleh PM2, mengkonsumsi job dari Redis_Queue melalui BullMQ, dan memanggil Internal_API.
- **Redis_Queue**: Antrian job berbasis BullMQ pada instans Redis lokal.
- **Database**: MariaDB yang menyimpan data persistensi SpecPilot melalui TypeORM.
- **User**: Aktor manusia yang terotentikasi pada SpecPilot melalui Frontend.
- **Project**: Entitas yang mewakili satu repositori Git target beserta metadata (nama, deskripsi, branch default, stack, root path, command test/lint/build, agent default).
- **Spec**: Dokumen kerja dalam Project yang berisi tiga Artifact dengan tipe `requirements`, `design`, dan `tasks`. Spec memiliki status: Draft, Ready, In Progress, Verification, Completed, Archived.
- **Artifact**: Dokumen markdown bertipe `requirements`, `design`, atau `tasks` yang dimiliki Spec dan disimpan dalam tabel `spec_artifacts` dengan strategi append-only versioning.
- **Artifact_Version**: Satu baris tabel `spec_artifacts` yang merepresentasikan satu versi konten Artifact dengan field `version`, `parent_id`, `is_current`, dan `generated_by` ∈ {`llm`, `user`}.
- **Task**: Satu item pekerjaan dalam Artifact bertipe `tasks`, memiliki kode (TSK-NNN), title, type, priority, dependency, dan acceptance criteria.
- **Ticket**: Unit kerja yang dapat dieksekusi Worker, diturunkan dari Task. Ticket memiliki status: Backlog, Ready, Running, Waiting Review, Approved, Rejected, Failed, Merged.
- **Execution**: Satu kali percobaan Worker mengeksekusi Ticket. Execution memiliki status: Queued, Preparing Workspace, Running Agent, Running Verification, Waiting Review, Completed, Failed, Cancelled.
- **Active_Execution**: Execution dengan status ∈ {Queued, Preparing Workspace, Running Agent, Running Verification}.
- **Agent**: Konfigurasi runner yang menyimpan provider, model, base URL, dan `config_json` (termasuk API key) untuk memanggil LLM atau CLI tool.
- **Agent_CLI**: Program eksternal seperti Claude Code, OpenCode, Codex CLI, Cline CLI, custom Node.js, atau custom Python yang dipanggil Worker melalui execa.
- **LLM_Service**: Komponen Backend_API (NestJS service) yang memanggil provider LLM untuk menghasilkan Artifact requirements/design/tasks.
- **Workspace**: Direktori `/storage/app/workspaces/{project_id}/` yang berisi `repo-main/`, `worktrees/`, `logs/`, dan `artifacts/`.
- **Worktree**: Subdirektori `worktrees/ticket-{ticket_id}/` yang dibuat dengan `git worktree add` untuk satu Execution.
- **Branch_Execution**: Branch Git baru yang dibuat di Worktree untuk satu Execution sebelum Agent_CLI dijalankan.
- **File_Change**: Satu baris tabel `file_changes` yang mencatat perubahan satu file (`change_type` ∈ {added, modified, deleted}, additions, deletions, diff).
- **Verification**: Eksekusi command test, lint, build, static check, spec compliance check, atau security quick scan terhadap hasil Execution.
- **Verification_Result**: Catatan satu hasil Verification dengan `type`, `command`, `status`, `exit_code`, `output`.
- **Commit_Service**: Komponen Backend_API (NestJS service) yang membuat commit Git dan melakukan push ke remote setelah approval.
- **Tasks_Parser**: Komponen yang membaca konten Artifact `tasks` (markdown checklist) dan menghasilkan struktur Task.
- **Tasks_Serializer**: Komponen yang menulis struktur Task menjadi konten Artifact `tasks` dalam format markdown checklist.
- **Worker_Secret**: String rahasia yang disimpan di environment variable `WORKER_SECRET` dan dikirim Worker ke Internal_API melalui header HTTP `X-Worker-Secret`.
- **JWT_Token**: Token autentikasi User berformat JSON Web Token yang ditandatangani Backend_API dengan algoritma HS256 atau RS256, memiliki masa berlaku 24 jam, disimpan di sisi klien, dan dikirim pada header `Authorization: Bearer <token>` untuk mengakses endpoint `/api/*`.

## Requirements

### Requirement 1: Project Management

**User Story:** Sebagai developer, saya ingin membuat dan mengelola Project beserta metadata teknisnya, sehingga setiap repositori Git target memiliki konteks kerja yang terstruktur di SpecPilot.

#### Acceptance Criteria

1. WHEN User terotentikasi mengirim permintaan pembuatan Project dengan field nama (1 sampai 120 karakter), deskripsi (0 sampai 2000 karakter), repository URL (format URL Git yang valid dengan skema https atau ssh, maksimal 500 karakter), branch default (1 sampai 100 karakter), stack, root path, command test, command lint, command build, dan agent default, THE Backend_API SHALL menyimpan Project baru ke Database dan mengembalikan identitas Project (project_id unik dan timestamp pembuatan) dalam waktu maksimal 2 detik.
2. IF permintaan pembuatan Project tidak menyertakan field wajib (nama, repository URL, branch default) atau field melanggar batasan panjang dan format yang ditetapkan, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 422 dan mengembalikan pesan validasi per field yang menjelaskan field bermasalah dan alasan penolakan, tanpa menyimpan data ke Database.
3. WHEN User terotentikasi yang merupakan pemilik Project mengirim permintaan pembaruan Project dengan project_id yang valid, THE Backend_API SHALL memperbarui metadata Project pada Database dan mengembalikan data Project yang telah diperbarui dalam waktu maksimal 2 detik.
4. WHEN User terotentikasi yang merupakan pemilik Project mengirim permintaan penghapusan Project dengan project_id yang valid, THE Backend_API SHALL menghapus Project dari Database beserta seluruh Spec, Artifact_Version, Ticket, dan Execution yang terkait dalam satu transaksi atomik dan mengembalikan konfirmasi penghapusan.
5. IF salah satu entitas terkait (Spec, Artifact_Version, Ticket, Execution) gagal dihapus saat penghapusan Project, THEN THE Backend_API SHALL membatalkan transaksi sehingga Project beserta seluruh entitas terkait tetap utuh, mengembalikan kode HTTP 500 dengan indikasi kegagalan transaksi, dan mempertahankan state Database seperti sebelum permintaan diterima.
6. IF User mengirim permintaan pembaruan, penghapusan, atau klona Project dengan project_id yang tidak ditemukan atau bukan milik User yang terotentikasi, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404 (resource tidak ditemukan) atau 403 (otorisasi ditolak) tanpa mengubah state Database.
7. WHEN User terotentikasi mengakses endpoint `GET /api/projects`, THE Backend_API SHALL mengembalikan daftar Project yang dimiliki oleh User tersebut, diurutkan berdasarkan timestamp pembaruan terakhir secara menurun, dengan paginasi maksimal 50 Project per halaman dan dalam waktu maksimal 2 detik.
8. WHERE Project memiliki repository URL yang valid, WHEN User terotentikasi yang merupakan pemilik Project memanggil endpoint `POST /api/projects/{project}/clone`, THE Backend_API SHALL men-trigger proses klona repositori ke `/storage/app/workspaces/{project_id}/repo-main/` dengan timeout eksekusi maksimal 300 detik dan mengembalikan status proses klona (berhasil, sedang berjalan, atau gagal).
9. IF proses klona repositori gagal karena URL tidak dapat dijangkau, autentikasi Git ditolak, atau timeout terlampaui, THEN THE Backend_API SHALL membatalkan operasi klona, membersihkan direktori `/storage/app/workspaces/{project_id}/repo-main/` agar tidak menyisakan artefak parsial, dan mengembalikan indikasi kegagalan beserta penyebab kegagalan kepada User.
10. THE Backend_API SHALL menolak setiap permintaan ke endpoint Project (`POST /api/projects`, `PUT /api/projects/{project}`, `DELETE /api/projects/{project}`, `GET /api/projects`, `POST /api/projects/{project}/clone`, `POST /api/projects/{project}/sync`) yang tidak menyertakan JWT token yang valid pada header `Authorization: Bearer <token>` dengan kode HTTP 401.

### Requirement 2: Authentication

**User Story:** Sebagai User, saya ingin login dan logout dengan aman, sehingga akses ke Project dan data hanya tersedia untuk pemilik akun.

#### Acceptance Criteria

1. WHEN User mengirim permintaan `POST /api/auth/login` dengan email (format RFC 5322, panjang 1 sampai 254 karakter) dan password (panjang 8 sampai 128 karakter) yang cocok dengan kredensial pada Database, THE Backend_API SHALL menerbitkan JWT token dengan masa berlaku 24 jam, mengembalikan kode HTTP 200, token, dan data User (id, name, email) dalam waktu maksimal 2 detik.
2. IF User mengirim permintaan login dengan email atau password yang tidak cocok, format email tidak valid, atau salah satu field kosong, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 401 dan pesan generik tanpa membedakan field mana yang salah, tanpa mengubah state Database.
3. IF email yang sama menerima 5 atau lebih permintaan login gagal dalam jendela 1 menit, THEN THE Backend_API SHALL menolak permintaan login berikutnya untuk email tersebut selama 5 menit dengan kode HTTP 429.
4. WHEN User mengirim permintaan logout dengan JWT token yang valid pada header `Authorization: Bearer <token>`, THE Backend_API SHALL mencabut token tersebut (denylist hingga waktu kedaluwarsa token), mengembalikan kode HTTP 200, dan permintaan berikutnya yang menggunakan token sama SHALL ditolak dengan kode HTTP 401.
5. IF permintaan ke endpoint `/api/*` (kecuali `POST /api/auth/login` dan `POST /api/auth/register`) tiba tanpa header `Authorization: Bearer <token>` yang berisi JWT token yang valid dan belum kedaluwarsa, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 401 tanpa mengembalikan data resource apapun.

### Requirement 3: Repository Connection

**User Story:** Sebagai developer, saya ingin menghubungkan Project ke repositori Git remote, sehingga SpecPilot dapat mengelola Workspace lokal dan branch eksekusi.

#### Acceptance Criteria

1. WHEN User memicu klona repositori melalui `POST /api/projects/{project}/clone`, THE Backend_API SHALL melakukan `git clone` repository URL Project ke direktori `/storage/app/workspaces/{project_id}/repo-main/` dengan timeout maksimum 300 detik.
2. IF direktori `/storage/app/workspaces/{project_id}/repo-main/` sudah ada dan tidak kosong saat klona dipicu, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 409 dan pesan yang menyatakan repositori sudah dikloning, tanpa mengubah isi direktori.
3. WHEN User memicu sinkronisasi melalui `POST /api/projects/{project}/sync`, THE Backend_API SHALL menjalankan `git fetch --all` pada `/storage/app/workspaces/{project_id}/repo-main/` dengan timeout maksimum 120 detik.
4. IF User memicu `POST /api/projects/{project}/sync` saat direktori `/storage/app/workspaces/{project_id}/repo-main/` belum ada, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404 dan pesan yang menyatakan repositori belum dikloning.
5. IF operasi `git clone` atau `git fetch` mengembalikan exit code bukan 0 atau melebihi timeout, THEN THE Backend_API SHALL mengembalikan kode HTTP 500 beserta pesan error stderr Git setelah memfilter token autentikasi remote, password, dan path SSH key.
6. IF operasi `git clone` gagal di tengah proses dan direktori `/storage/app/workspaces/{project_id}/repo-main/` berisi artefak parsial, THEN THE Backend_API SHALL menghapus direktori tersebut sebelum mengembalikan response error.
7. IF dua permintaan klona atau sync untuk Project yang sama dipicu secara bersamaan, THEN THE Backend_API SHALL menolak permintaan kedua dengan kode HTTP 409 dan pesan yang menyatakan operasi Git sedang berjalan untuk Project tersebut.
8. THE Backend_API SHALL menyimpan SSH key per Project pada konfigurasi yang tidak pernah ditampilkan pada response API publik maupun pesan error, dengan akses baca file SSH key dibatasi pada proses Backend_API.

### Requirement 4: Spec Manager

**User Story:** Sebagai developer, saya ingin membuat dan mengelola Spec di dalam Project, sehingga setiap unit fitur memiliki requirements.md, design.md, dan tasks.md yang dapat ditelusuri.

#### Acceptance Criteria

1. WHEN User terotentikasi yang merupakan pemilik Project membuat Spec dengan field title (1 sampai 200 karakter) dan summary (0 sampai 2000 karakter), THE Backend_API SHALL menyimpan Spec baru pada Database dengan status awal `Draft` dan mengembalikan identitas Spec dalam waktu maksimal 2 detik.
2. WHEN User mengubah status Spec melalui endpoint Backend_API dengan nilai dari himpunan {`Draft`, `Ready`, `In Progress`, `Verification`, `Completed`, `Archived`}, THE Backend_API SHALL memperbarui status Spec pada Database.
3. IF User mengirim permintaan ubah status Spec dengan nilai di luar himpunan {`Draft`, `Ready`, `In Progress`, `Verification`, `Completed`, `Archived`}, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 422 dan tidak mengubah status Spec yang ada.
4. WHEN User membuka Spec, THE Backend_API SHALL mengembalikan tiga Artifact aktif untuk tipe `requirements`, `design`, dan `tasks` (Artifact_Version dengan `is_current = true`) atau null jika tipe tersebut belum memiliki Artifact_Version, dalam waktu maksimal 2 detik.
5. WHEN User menghapus Spec, THE Backend_API SHALL menghapus seluruh Artifact_Version dan Ticket yang terkait dengan Spec tersebut dalam satu transaksi atomik; jika salah satu entitas terkait gagal dihapus, THE Backend_API SHALL membatalkan transaksi sehingga Spec dan seluruh entitas terkait tetap utuh.
6. IF User membuat Spec dengan field title atau summary yang melanggar batasan panjang, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 422 dan pesan validasi per field tanpa menyimpan data ke Database.
7. IF User mengirim permintaan buka, ubah status, atau hapus Spec dengan spec_id yang tidak ditemukan atau bukan milik User yang terotentikasi, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404 atau 403 tanpa mengubah state Database.

### Requirement 5: Generate Requirements Artifact dari Prompt

**User Story:** Sebagai developer, saya ingin membuat requirements.md dari prompt natural language, sehingga proses awal spec dapat dipercepat.

#### Acceptance Criteria

1. WHEN User memanggil `POST /api/specs/{spec}/generate-requirements` dengan field prompt (1 sampai 10000 karakter), THE LLM_Service SHALL mengirim prompt template requirements ke provider LLM yang dikonfigurasi User dan menunggu response markdown dengan timeout maksimum 60 detik.
2. WHEN LLM_Service menerima response markdown yang memuat seluruh bagian Problem Statement, Goals, Non-goals, User Stories, Functional Requirements, Non-functional Requirements, Business Rules, Edge Cases, dan Acceptance Criteria sebagai heading markdown yang dapat dikenali, THE Artifact_Versioning_Service SHALL menyimpan response sebagai Artifact_Version baru bertipe `requirements` dengan `generated_by = 'llm'`.
3. THE Artifact bertipe `requirements` SHALL memuat kesembilan bagian (Problem Statement, Goals, Non-goals, User Stories, Functional Requirements, Non-functional Requirements, Business Rules, Edge Cases, Acceptance Criteria) sebagai heading markdown dengan setiap bagian berisi minimal satu baris konten non-kosong.
4. IF provider LLM mengembalikan error, melebihi timeout 60 detik, mengembalikan response yang melebihi 200000 karakter, atau response tidak memuat seluruh bagian wajib pada criterion 3, THEN THE Backend_API SHALL mengembalikan kode HTTP 502 beserta pesan error tanpa menyimpan Artifact_Version baru dan tanpa mengubah Artifact_Version yang sudah ada.
5. IF User memanggil endpoint generate-requirements dengan prompt kosong, hilang, atau melebihi 10000 karakter, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 400 tanpa memanggil provider LLM.
6. WHEN User menyimpan hasil edit manual requirements melalui `PUT /api/specs/{spec}` atau endpoint artifact dengan konten 1 sampai 200000 karakter, THE Artifact_Versioning_Service SHALL menyimpan konten sebagai Artifact_Version baru dengan `generated_by = 'user'`, tanpa mengubah versi sebelumnya.

### Requirement 6: Generate Design Artifact dari Requirements

**User Story:** Sebagai developer, saya ingin menghasilkan design.md dari requirements.md, sehingga design selalu mengacu ke requirements terkini.

#### Acceptance Criteria

1. WHEN User memanggil `POST /api/specs/{spec}/generate-design`, THE LLM_Service SHALL mengirim prompt template design dengan input konten Artifact_Version `requirements` yang `is_current = true` ke provider LLM dan menunggu response dengan timeout maksimum 120 detik.
2. IF Spec belum memiliki Artifact_Version `requirements` dengan `is_current = true`, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 409 dan pesan yang menyatakan requirements belum tersedia.
3. WHEN LLM_Service menerima response markdown design yang memuat seluruh bagian wajib pada criterion 4, THE Artifact_Versioning_Service SHALL menyimpan response sebagai Artifact_Version baru bertipe `design` dengan `generated_by = 'llm'` dan `is_current = true`, sambil menetapkan `is_current = false` pada versi design sebelumnya.
4. THE Artifact bertipe `design` SHALL memuat kesepuluh bagian Overview Solusi, Arsitektur Sistem, Struktur Folder, Data Model, API Design, UI Design, Security Consideration, Error Handling, Testing Strategy, dan Rollback Strategy sebagai heading markdown yang dapat dikenali.
5. IF provider LLM mengembalikan error, melebihi timeout 120 detik, atau response tidak memuat seluruh bagian wajib pada criterion 4, THEN THE Backend_API SHALL mengembalikan kode HTTP 502 beserta pesan error tanpa menyimpan Artifact_Version baru.
6. WHEN User membuka mode preview design dan konten design memuat blok kode dengan bahasa `mermaid`, THE Frontend SHALL merender blok tersebut sebagai diagram Mermaid.

### Requirement 7: Generate Tasks Artifact dari Design

**User Story:** Sebagai developer, saya ingin menghasilkan tasks.md sebagai checklist terstruktur dari design.md, sehingga pekerjaan dapat dipecah menjadi unit kerja terukur.

#### Acceptance Criteria

1. WHEN User memanggil `POST /api/specs/{spec}/generate-tasks`, THE LLM_Service SHALL mengirim prompt template tasks dengan input konten Artifact_Version `design` yang `is_current = true` ke provider LLM dan menunggu response dengan timeout maksimum 60 detik.
2. IF Spec tidak ditemukan atau belum memiliki Artifact_Version `design` dengan `is_current = true`, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404 atau 409 dan pesan yang menjelaskan penyebab, tanpa membuat Artifact_Version baru.
3. WHEN LLM_Service menerima response markdown tasks yang memuat minimal satu item checklist valid, THE Artifact_Versioning_Service SHALL menyimpan response sebagai Artifact_Version baru bertipe `tasks` dengan `generated_by = 'llm'` dan `is_current = true`.
4. THE Artifact bertipe `tasks` SHALL berisi daftar checklist berukuran 1 sampai 500 item dengan setiap item memuat: kode TSK-NNN (NNN adalah 3 digit numerik 001-999, unik dalam Spec), title (1-200 karakter), Type ∈ {`backend`, `frontend`, `fullstack`, `infra`, `docs`, `test`}, Priority ∈ {`high`, `medium`, `low`}, Depends on (daftar kode TSK-NNN yang merujuk task lain dalam Spec yang sama atau `none`), dan Acceptance (1-1000 karakter).
5. IF provider LLM mengembalikan error, melebihi timeout 60 detik, atau response tidak memuat minimal satu item checklist valid sesuai criterion 4, THEN THE Backend_API SHALL mengembalikan kode HTTP 502 beserta pesan error tanpa menyimpan Artifact_Version baru.

### Requirement 8: Tasks Parser dan Serializer

**User Story:** Sebagai developer, saya ingin SpecPilot mengonversi konten markdown tasks menjadi struktur Task pada Database dan kembali menjadi markdown, sehingga UI checklist dan storage Database tetap konsisten.

#### Acceptance Criteria

1. WHEN konten Artifact `tasks` valid (format checklist sesuai PRD bagian 5.5, ukuran maksimum 5 MB, jumlah item 0 sampai 10000) diberikan ke Tasks_Parser, THE Tasks_Parser SHALL mengembalikan daftar Task dengan field code (format `TSK-NNN`), title (1-200 karakter), type (∈ {`backend`, `frontend`, `fullstack`, `infra`, `docs`, `test`}), priority (∈ {`high`, `medium`, `low`}), depends_on (daftar kode `TSK-NNN` atau `none`), dan acceptance_criteria (1-1000 karakter).
2. WHEN konten Artifact `tasks` valid tetapi tidak memuat item checklist apapun, THE Tasks_Parser SHALL mengembalikan daftar Task kosong tanpa error.
3. IF konten Artifact `tasks` tidak memenuhi format checklist (`- [ ]` atau `- [x]` di awal item), atau salah satu field item melanggar batasan pada criterion 1, THEN THE Tasks_Parser SHALL mengembalikan error terstruktur yang menyebutkan nomor baris pertama yang invalid (1-indexed) dan jenis pelanggaran, tanpa menghasilkan daftar Task parsial.
4. IF salah satu nilai `depends_on` merujuk ke kode `TSK-NNN` yang tidak ada dalam daftar, atau membentuk siklus dependency, THEN THE Tasks_Parser SHALL mengembalikan error terstruktur yang menyebutkan kode Task yang melanggar dan jenis pelanggaran (referensi tidak ada atau siklus terdeteksi).
5. WHEN daftar Task yang valid diberikan ke Tasks_Serializer, THE Tasks_Serializer SHALL mengembalikan konten markdown checklist sesuai format pada PRD bagian 5.5 dalam waktu maksimum 2 detik untuk daftar hingga 10000 item, dengan terminator baris dan whitespace trailing dinormalisasi.
6. FOR ALL daftar Task valid `t`, THE komposisi `Tasks_Parser(Tasks_Serializer(t))` SHALL menghasilkan daftar Task `t'` yang identik dengan `t` dalam jumlah item, urutan item, dan nilai setiap field per item (round-trip property).
7. FOR ALL konten markdown tasks valid `m` yang dihasilkan oleh Tasks_Serializer, THE komposisi `Tasks_Serializer(Tasks_Parser(m))` SHALL menghasilkan konten yang ekuivalen dengan `m` setelah normalisasi terminator baris dan whitespace trailing baris (round-trip property).

### Requirement 9: Append-only Artifact Versioning

**User Story:** Sebagai developer, saya ingin setiap perubahan Artifact disimpan sebagai versi baru tanpa pernah menimpa versi sebelumnya, sehingga riwayat perubahan dapat ditelusuri dan dipulihkan.

#### Acceptance Criteria

1. WHEN Artifact_Versioning_Service menyimpan versi baru untuk pasangan (Spec, type), THE Artifact_Versioning_Service SHALL melakukan `INSERT` baris baru pada `spec_artifacts` tanpa pernah `UPDATE` field `content` baris yang sudah ada.
2. WHEN Artifact_Versioning_Service menyimpan versi baru untuk pasangan (Spec, type), THE Artifact_Versioning_Service SHALL melakukan operasi atomik dalam satu transaksi yang menetapkan `is_current = false` pada baris versi sebelumnya yang `is_current = true` (jika ada) lalu menyisipkan baris baru dengan `is_current = true`, sehingga jika salah satu langkah gagal, seluruh perubahan di-rollback dan state database tidak berubah.
3. THE Artifact_Versioning_Service SHALL memastikan untuk setiap pasangan (`spec_id`, `type`) hanya ada paling banyak satu baris dengan `is_current = true` pada setiap titik waktu, dan menolak penyimpanan versi baru yang akan menghasilkan lebih dari satu baris `is_current = true` untuk pasangan tersebut.
4. WHEN Artifact_Versioning_Service menyimpan versi baru, THE Artifact_Versioning_Service SHALL menetapkan field `version` baris baru sama dengan `MAX(version) + 1` dari pasangan (`spec_id`, `type`) yang sama, atau 1 jika belum ada baris.
5. WHEN Artifact_Versioning_Service menyimpan versi baru selain versi pertama, THE Artifact_Versioning_Service SHALL menetapkan `parent_id` baris baru sama dengan `id` baris versi sebelumnya yang baru saja di-set `is_current = false`.
6. WHEN jumlah baris untuk pasangan (`spec_id`, `type`) melebihi 50 setelah penyimpanan versi baru, THE Artifact_Versioning_Service SHALL menghapus baris paling lama (berdasarkan `version` terkecil) dengan `is_current = false` hingga jumlah baris menjadi tepat 50, tanpa pernah menghapus baris dengan `is_current = true`.
7. THE Artifact_Versioning_Service SHALL menetapkan `generated_by ∈ {'llm', 'user'}` pada setiap baris baru, dan IF nilai `generated_by` yang diberikan tidak termasuk dalam himpunan tersebut, THEN THE Artifact_Versioning_Service SHALL menolak penyimpanan dengan error validasi yang mengindikasikan nilai `generated_by` tidak valid, tanpa menyisipkan baris baru.
8. WHEN User memanggil `POST /api/specs/{spec}/artifacts/{type}/versions/{version}/restore` dengan version yang ada untuk pasangan (Spec, type) tersebut, THE Artifact_Versioning_Service SHALL menyisipkan Artifact_Version baru dengan content sama persis (byte-for-byte identik) dengan content versi sumber, `generated_by = 'user'`, dan `change_summary = "Restored from version {version}"`, tanpa menghapus versi manapun.
9. IF User memanggil endpoint restore dengan `version` yang tidak ada untuk pasangan (Spec, type) tersebut, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404 yang mengindikasikan versi tidak ditemukan, dan THE Artifact_Versioning_Service SHALL tidak menyisipkan baris baru maupun mengubah `is_current` pada baris manapun.
10. THE Backend_API SHALL menyediakan endpoint `GET /api/specs/{spec}/artifacts/{type}/versions/{versionA}/diff/{versionB}` yang mengembalikan diff line-based antara konten dua Artifact_Version, di mana setiap baris ditandai sebagai unchanged, added, atau removed, dan respons dikembalikan dalam waktu maksimum 2 detik untuk konten hingga 100000 karakter.
11. IF User memanggil endpoint diff dengan `versionA` atau `versionB` yang tidak ada untuk pasangan (Spec, type) tersebut, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404, tanpa mengembalikan diff parsial.
12. WHEN LLM_Service melakukan regenerate Artifact, THE Artifact_Versioning_Service SHALL menyimpan hasil regenerate sebagai Artifact_Version baru dengan `generated_by = 'llm'` tanpa menghapus atau menimpa Artifact_Version dengan `generated_by = 'user'` yang sudah ada, termasuk pada saat pruning ketika jumlah baris melebihi 50.

### Requirement 10: Ticket Management dari Tasks

**User Story:** Sebagai developer, saya ingin mengubah Task menjadi Ticket yang dapat dieksekusi agent, sehingga pekerjaan terstruktur sampai ke unit eksekusi.

#### Acceptance Criteria

1. WHEN User terotentikasi memanggil `POST /api/specs/{spec}/tickets` dengan field `task_id` yang merujuk Task pada Spec tersebut, THE Backend_API SHALL membuat Ticket baru dengan status `Backlog`, mengkopi title (1-200 karakter) dan description (0-5000 karakter) dari Task, menetapkan branch_name awal dengan format `specpilot/ticket-{ticket_id}`, dan mengembalikan Ticket yang dibuat dalam waktu maksimum 2 detik.
2. IF `task_id` pada permintaan pembuatan Ticket tidak ditemukan, bukan milik Spec yang dirujuk, atau sudah memiliki Ticket aktif, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404 atau 409 dan pesan yang menjelaskan penyebab, tanpa menyimpan Ticket baru.
3. WHEN User memanggil endpoint pembaruan status Ticket dengan nilai dari himpunan {`Backlog`, `Ready`, `Running`, `Waiting Review`, `Approved`, `Rejected`, `Failed`, `Merged`}, THE Backend_API SHALL memperbarui status Ticket pada Database.
4. IF User mengirim permintaan ubah status Ticket dengan nilai di luar himpunan pada criterion 3, atau dengan transisi yang tidak valid (misalnya dari `Merged` ke `Backlog`), THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 422 tanpa mengubah status Ticket.
5. WHEN User memanggil `PUT /api/tickets/{ticket}` dengan field `agent_id` yang merujuk Agent milik User yang sama, THE Backend_API SHALL menyimpan `agent_id` Ticket sesuai pilihan User.
6. IF `agent_id` pada permintaan update Ticket tidak ditemukan atau bukan milik User yang terotentikasi, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404 atau 403 tanpa mengubah Ticket.
7. WHEN User memanggil `GET /api/projects/{project}/tickets`, THE Backend_API SHALL mengembalikan daftar Ticket per Project dengan field id, title, status, priority, agent_id, branch_name, dan timestamp pembaruan terakhir, diurutkan menurun berdasarkan timestamp pembaruan, dengan paginasi maksimum 50 Ticket per halaman.

### Requirement 11: Concurrent Execution Guard per Project

**User Story:** Sebagai tech lead, saya ingin SpecPilot membatasi jumlah Active_Execution per Project menjadi satu, sehingga workspace tidak mengalami race condition dan execution mudah ditelusuri.

#### Acceptance Criteria

1. WHEN User terotentikasi memanggil `POST /api/tickets/{ticket}/run`, THE Backend_API SHALL memeriksa eksistensi Active_Execution (Execution dengan status ∈ {`Queued`, `Preparing Workspace`, `Running Agent`, `Running Verification`}) untuk Project pemilik Ticket sebelum menyisipkan Execution baru.
2. IF Project pemilik Ticket sudah memiliki Active_Execution saat `POST /api/tickets/{ticket}/run` dipanggil, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 409 dan pesan: "Ada execution aktif untuk project ini. Tunggu hingga selesai atau hentikan execution sebelumnya." dalam waktu maksimum 2 detik.
3. WHEN Backend_API berhasil melewati pemeriksaan Active_Execution, THE Backend_API SHALL menyisipkan baris `executions` dengan status `Queued` dan mendorong satu job ke Redis_Queue dalam alur transaksional yang sama.
4. IF `INSERT` Execution gagal pada langkah criterion 3, THEN THE Backend_API SHALL membatalkan operasi dan tidak mendorong job apapun ke Redis_Queue, mengembalikan kode HTTP 500.
5. IF push job ke Redis_Queue gagal setelah `INSERT` Execution berhasil, THEN THE Backend_API SHALL melakukan rollback dengan menetapkan status Execution menjadi `Failed` dan mengembalikan kode HTTP 502, sehingga tidak ada Execution berstatus `Queued` yang tidak memiliki job di Redis_Queue.
6. FOR ALL Project P, THE invarian `COUNT(executions WHERE project_id = P AND status IN ('Queued','Preparing Workspace','Running Agent','Running Verification')) <= 1` SHALL bernilai true setelah setiap operasi `POST /api/tickets/{ticket}/run` selesai, baik berhasil maupun gagal (correctness property).
7. THE Backend_API SHALL menggunakan kunci eksklusif tingkat baris (row lock) atau constraint database setara saat memeriksa dan menyisipkan Execution dengan timeout akuisisi kunci maksimum 5 detik untuk mencegah dua permintaan paralel lolos pemeriksaan secara bersamaan.
8. IF akuisisi kunci eksklusif melebihi timeout 5 detik, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 503 tanpa menyisipkan Execution baru.

### Requirement 12: Workspace Isolation per Execution

**User Story:** Sebagai developer, saya ingin setiap Execution berjalan di Worktree terpisah, sehingga perubahan satu Ticket tidak bertabrakan dengan Ticket lain.

#### Acceptance Criteria

1. WHEN Worker memulai Execution dengan id E pada Project P dan Ticket dengan id ticket_id, THE Worker SHALL membuat Worktree pada path `/storage/app/workspaces/{P}/worktrees/ticket-{ticket_id}/` melalui `git worktree add` yang merujuk ke Branch_Execution baru, dengan timeout maksimum 60 detik untuk operasi tersebut.
2. IF path Worktree `/storage/app/workspaces/{P}/worktrees/ticket-{ticket_id}/` sudah ada sebelum `git worktree add` dijalankan, THEN THE Worker SHALL menghapus path tersebut terlebih dahulu menggunakan `git worktree remove --force` sebelum membuat Worktree baru.
3. THE Worker SHALL menjalankan Agent_CLI dan command Verification hanya di dalam Worktree milik Execution yang sedang aktif.
4. FOR ALL pasangan Execution aktif `E1` dan `E2` (baik dari Project yang sama dengan Ticket berbeda maupun dari Project yang berbeda), THE path Worktree `E1` dan `E2` SHALL tidak overlap dan tidak saling menjadi subdirektori (correctness property: workspace isolation).
5. WHEN Execution selesai dengan status Completed, Failed, atau Cancelled, THE Worker SHALL menjalankan `git worktree remove --force` untuk path Worktree Execution tersebut dengan timeout maksimum 60 detik.
6. IF `git worktree remove --force` gagal atau melebihi timeout 60 detik pada saat cleanup, THEN THE Worker SHALL mencatat error pada field `error_message` Execution (maksimum 2000 karakter) dan menandai path Worktree sebagai stale tanpa memblokir Execution berikutnya.
7. IF Worker gagal membuat Worktree (termasuk kegagalan `git worktree add`, kegagalan pembuatan Branch_Execution, atau timeout 60 detik terlampaui), THEN THE Worker SHALL memanggil `PATCH /internal/executions/{id}` dengan status `Failed`, menyimpan pesan error yang mengindikasikan penyebab kegagalan pada field `error_message` (maksimum 2000 karakter), dan tidak menjalankan Agent_CLI maupun command Verification.

### Requirement 13: Worker Job Lifecycle dan Internal API Callback

**User Story:** Sebagai developer, saya ingin Worker melaporkan status, log, file changes, dan hasil verification ke Backend_API melalui Internal_API, sehingga Frontend dapat menampilkan progress eksekusi.

#### Acceptance Criteria

1. WHEN Worker mengambil job dari Redis_Queue, THE Worker SHALL memanggil `PATCH /internal/executions/{id}` dengan status `Preparing Workspace` dalam waktu maksimum 5 detik sebelum operasi Git dimulai.
2. WHEN Worker selesai menyiapkan Worktree, THE Worker SHALL memanggil `PATCH /internal/executions/{id}` dengan status `Running Agent` dalam waktu maksimum 5 detik sebelum Agent_CLI di-spawn.
3. WHILE Agent_CLI sedang berjalan, THE Worker SHALL mengirim batch entri log ke `POST /internal/executions/{id}/logs` dengan interval maksimum 500 milidetik per batch dan ukuran batch maksimum 100 entri atau 256 KB payload (mana yang tercapai lebih dulu).
4. WHEN Agent_CLI selesai dengan exit code 0 sebelum job timeout tercapai, THE Worker SHALL menjalankan `git status` dan `git diff` dalam waktu maksimum 30 detik lalu mengirim payload ke `POST /internal/executions/{id}/changes` berisi daftar `file_path`, `change_type`, `additions`, `deletions`, dan `diff` per file.
5. WHEN Worker selesai menjalankan command Verification, THE Worker SHALL memanggil `POST /internal/executions/{id}/verify-result` dengan daftar `type`, `command`, `status` ∈ {`passed`, `failed`, `skipped`, `timeout`}, `exit_code` (integer 0-255 atau null), dan `output` (maksimum 1 MB per entri).
6. WHEN seluruh tahap Worktree preparation, Agent_CLI execution, change collection, dan Verification selesai, THE Worker SHALL memanggil `PATCH /internal/executions/{id}` dengan status `Waiting Review` dalam waktu maksimum 5 detik.
7. IF Internal_API menerima permintaan tanpa header `X-Worker-Secret` yang sama persis dengan nilai pada konfigurasi Backend_API (perbandingan byte-for-byte), THEN THE Internal_API SHALL menolak permintaan dengan kode HTTP 401 dan tidak memproses payload request.
8. IF Internal_API menerima permintaan yang menyertakan header `Authorization: Bearer <token>` (JWT) atau cookie autentikasi User, THEN THE Internal_API SHALL menolak permintaan dengan kode HTTP 401.
9. WHEN Backend_API memproses permintaan apapun (publik maupun internal) dan menulis log aplikasi, THE Backend_API SHALL tidak menyertakan nilai `WORKER_SECRET` atau API key Agent pada response body, response header, maupun entri log; nilai tersebut SHALL diganti dengan placeholder `[REDACTED]` jika perlu di-log.
10. IF Worker mengalami crash atau job timeout pada BullMQ, THEN BullMQ SHALL melakukan retry maksimum satu kali.
11. IF retry BullMQ pada criterion 10 juga gagal, THEN Worker SHALL memanggil `PATCH /internal/executions/{id}` dengan status `Failed` dalam waktu maksimum 10 detik dengan `error_message` yang mengindikasikan penyebab kegagalan.
12. IF panggilan Internal_API mengembalikan error 5xx atau gagal karena network error, THEN Worker SHALL melakukan retry dengan exponential backoff (delay awal 1 detik, faktor 2, delay maksimum 60 detik, maksimum 5 attempt) sebelum menandai job gagal.
13. IF `git status` atau `git diff` mengembalikan exit code bukan 0, THEN Worker SHALL memanggil `PATCH /internal/executions/{id}` dengan status `Failed` dan `error_message` yang memuat stderr Git (maksimum 2000 karakter).

### Requirement 14: Agent Execution Timeout

**User Story:** Sebagai tech lead, saya ingin Worker mengakhiri Agent_CLI yang melebihi batas waktu, sehingga Execution tidak menggantung tanpa batas.

#### Acceptance Criteria

1. THE Worker SHALL membaca nilai `timeout` (integer detik, rentang valid 1 sampai 7200) dari `config_json` Agent dengan nilai default 600 detik jika field `timeout` tidak ada.
2. IF nilai `timeout` pada `config_json` tidak berupa integer atau berada di luar rentang 1 sampai 7200, THEN Worker SHALL menggunakan nilai default 600 detik dan menulis entri log dengan level `warn` yang mengindikasikan nilai timeout tidak valid.
3. WHEN durasi sejak spawn Agent_CLI mencapai nilai timeout, THE Worker SHALL mengirim signal `SIGTERM` ke proses Agent_CLI dalam waktu maksimum 1 detik setelah threshold tercapai.
4. WHEN Worker mengirim `SIGTERM` karena timeout, THE Worker SHALL menunggu 10 detik penuh sebelum mengirim `SIGKILL`, terlepas dari status responsivitas proses Agent_CLI.
5. IF proses Agent_CLI belum berhenti pada akhir periode 10 detik tersebut, THEN THE Worker SHALL mengirim signal `SIGKILL` ke proses Agent_CLI.
6. WHEN Worker mengakhiri Agent_CLI karena timeout, THE Worker SHALL memanggil `PATCH /internal/executions/{id}` dengan status `Failed` dan `error_message = "Execution timeout"`.
7. IF panggilan `PATCH /internal/executions/{id}` pada criterion 6 gagal, THEN Worker SHALL mengulang panggilan dengan exponential backoff (delay awal 1 detik, faktor 2, delay maksimum 60 detik, maksimum 8 attempt) hingga panggilan berhasil sebelum menandai job selesai.
8. IF seluruh 8 attempt retry pada criterion 7 gagal, THEN Worker SHALL menulis entri log dengan level `error` yang mengindikasikan kegagalan callback dan tetap menandai job sebagai gagal pada BullMQ untuk mencegah job tergantung.

### Requirement 15: Manual Stop Execution

**User Story:** Sebagai developer, saya ingin menghentikan Execution yang sedang berjalan secara manual, sehingga proses yang salah arah dapat dibatalkan.

#### Acceptance Criteria

1. WHEN User terotentikasi memanggil `POST /api/executions/{execution}/stop` untuk Execution dengan status ∈ {`Queued`, `Preparing Workspace`, `Running Agent`, `Running Verification`}, THE Backend_API SHALL memublikasikan sinyal stop pada Redis_Queue untuk job terkait, memperbarui status Execution menjadi `Cancelled`, dan mengembalikan kode HTTP 202 dalam waktu maksimum 2 detik.
2. WHEN User memanggil endpoint stop berulang untuk Execution yang sudah berstatus `Cancelled`, THE Backend_API SHALL mengembalikan kode HTTP 200 secara idempoten tanpa mempublikasikan sinyal stop tambahan dan tanpa mengubah state.
3. WHEN Worker menerima sinyal stop untuk job yang sedang dieksekusi, THE Worker SHALL mengirim `SIGTERM` ke Agent_CLI dan menunggu maksimum 30 detik sebelum mengirim `SIGKILL` jika proses belum berhenti.
4. IF Agent_CLI belum berhenti dalam 30 detik setelah `SIGTERM`, THEN Worker SHALL mengirim `SIGKILL` ke Agent_CLI.
5. WHEN proses Agent_CLI sudah berhenti, THE Worker SHALL menjalankan cleanup Worktree dengan timeout maksimum 60 detik untuk operasi `git worktree remove --force`.
6. IF User memanggil `POST /api/executions/{execution}/stop` untuk Execution dengan status ∉ {`Queued`, `Preparing Workspace`, `Running Agent`, `Running Verification`, `Cancelled`}, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 409 tanpa mengubah state.

### Requirement 16: Realtime Execution Logs

**User Story:** Sebagai developer, saya ingin melihat log Execution secara realtime di Frontend, sehingga progress agent dapat dimonitor saat berjalan.

#### Acceptance Criteria

1. WHEN Backend_API menerima batch log (1 sampai 500 entri per request) pada `POST /internal/executions/{id}/logs`, THE Backend_API SHALL menyisipkan setiap entri log ke tabel `execution_logs` mempertahankan urutan kedatangan dan mem-broadcast setiap entri melalui WebSocket pada channel `execution.{id}` dalam waktu maksimal 1 detik setelah penyisipan berhasil.
2. IF penyisipan satu atau lebih entri log ke tabel `execution_logs` gagal, THEN THE Backend_API SHALL menolak request dengan response error yang mengindikasikan kegagalan penyimpanan, tidak mem-broadcast entri yang gagal disimpan, dan mempertahankan entri lain yang sudah berhasil disimpan dalam batch yang sama.
3. WHEN User membuka halaman detail Execution, THE Frontend SHALL berlangganan channel `execution.{id}` dan menampilkan setiap entri log baru yang diterima tanpa reload halaman dalam urutan kronologis berdasarkan `created_at`.
4. WHEN koneksi WebSocket pada channel `execution.{id}` terputus saat halaman detail Execution masih terbuka, THE Frontend SHALL mencoba menyambung ulang otomatis hingga maksimal 5 kali dengan interval minimal 2 detik dan menampilkan indikator status koneksi kepada User.
5. WHEN Backend_API menerima request pada `GET /api/executions/{execution}/logs`, THE Backend_API SHALL mengembalikan entri log untuk Execution tersebut diurutkan secara ascending berdasarkan `created_at`, dengan ukuran halaman default 100 entri dan maksimum 500 entri per halaman.
6. THE Backend_API SHALL menyimpan setiap entri log dengan field `level` bernilai salah satu dari {`debug`, `info`, `warn`, `error`}, field `source` bernilai salah satu dari {`agent`, `worker`, `system`}, field `message` berupa string dengan panjang 1 sampai 10000 karakter, dan field `created_at` berupa timestamp dengan presisi milidetik.

### Requirement 17: Diff Review

**User Story:** Sebagai developer, saya ingin melihat daftar file yang berubah beserta diff per file, sehingga setiap perubahan dapat ditinjau sebelum commit.

#### Acceptance Criteria

1. WHEN Backend_API menerima payload pada `POST /internal/executions/{id}/changes` dengan field `file_path` (1-1000 karakter), `change_type` ∈ {`added`, `modified`, `deleted`}, `additions` (integer ≥ 0), `deletions` (integer ≥ 0), dan `diff` (string maksimum 5 MB), THE Backend_API SHALL menyimpan setiap entri ke tabel `file_changes` dengan `review_status` awal `pending`.
2. IF payload pada `POST /internal/executions/{id}/changes` melanggar batasan field pada criterion 1 atau memuat `change_type` di luar himpunan yang ditentukan, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 400 tanpa menyimpan entri apapun pada batch tersebut.
3. WHEN User memanggil `GET /api/executions/{execution}/changes`, THE Backend_API SHALL mengembalikan daftar File_Change untuk Execution diurutkan berdasarkan `file_path` ascending, dengan paginasi maksimum 200 entri per halaman, dalam waktu maksimum 2 detik.
4. IF User memanggil `GET /api/executions/{execution}/changes` untuk Execution yang tidak ditemukan, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404.
5. THE Frontend SHALL menampilkan diff per file dengan syntax highlighting berdasarkan ekstensi file untuk minimal ekstensi {`.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.php`, `.py`, `.go`, `.rs`, `.java`, `.json`, `.yaml`, `.yml`, `.md`, `.css`, `.scss`, `.html`, `.sql`}, dan menggunakan plain-text rendering sebagai fallback untuk ekstensi lain.
6. THE Frontend SHALL menyediakan filter daftar File_Change berdasarkan `change_type ∈ {added, modified, deleted}` yang dapat dikombinasikan, dan menampilkan pesan kosong jika kombinasi filter tidak menghasilkan entri.
7. WHEN User menandai File_Change dengan `review_status` ∈ {`pending`, `reviewed`, `approved`, `rejected`} per file, THE Backend_API SHALL menyimpan perubahan tersebut ke tabel `file_changes` dan respon mencerminkan nilai terbaru.

### Requirement 18: Approve dan Reject Hasil Execution

**User Story:** Sebagai tech lead, saya ingin menyetujui atau menolak hasil Execution sebelum commit, sehingga kontrol akhir terhadap perubahan tetap di tangan User.

#### Acceptance Criteria

1. WHEN User memanggil `POST /api/tickets/{ticket}/approve` untuk Ticket dengan status `Waiting Review`, THE Backend_API SHALL mengubah status Ticket menjadi `Approved`, mencatat timestamp transisi dan identitas User yang melakukan approve, serta mengembalikan respons sukses berisi data Ticket yang sudah diperbarui dalam waktu maksimal 2 detik.
2. WHEN User memanggil `POST /api/tickets/{ticket}/reject` untuk Ticket dengan status `Waiting Review`, THE Backend_API SHALL mengubah status Ticket menjadi `Rejected`, mencatat timestamp transisi dan identitas User yang melakukan reject, dan men-trigger cleanup Worktree milik Execution terkait dalam waktu maksimal 30 detik setelah perubahan status.
3. IF User memanggil endpoint approve atau reject pada Ticket dengan status di luar `Waiting Review`, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 409 disertai pesan yang mengindikasikan status Ticket saat ini dan status yang valid untuk operasi tersebut, tanpa mengubah status Ticket.
4. IF User memanggil endpoint approve atau reject pada Ticket yang tidak ditemukan, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 404 disertai pesan yang mengindikasikan Ticket tidak ditemukan.
5. WHEN User memilih opsi "Ask Agent to Fix" pada hasil Execution dengan menyertakan daftar review comment yang berisi minimal 1 dan maksimal 50 entri di mana setiap entri memiliki teks 1 sampai 4000 karakter, THE Backend_API SHALL membuat Execution baru pada Ticket yang sama yang membawa daftar review comment tersebut sebagai bagian prompt Agent, sesuai aturan concurrency pada Requirement 11.
6. IF User memanggil opsi "Ask Agent to Fix" tanpa daftar review comment yang valid sesuai batasan jumlah dan panjang teks, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 400 disertai pesan yang mengindikasikan field review comment tidak valid, tanpa membuat Execution baru.
7. IF cleanup Worktree pada proses reject gagal diselesaikan dalam batas waktu 30 detik, THEN THE Backend_API SHALL mempertahankan status Ticket sebagai `Rejected`, mencatat kegagalan cleanup beserta penyebabnya, dan menandai Worktree terkait untuk retry cleanup tanpa membatalkan transisi status Ticket.

### Requirement 19: Verification Commands

**User Story:** Sebagai developer, saya ingin sistem menjalankan command test, lint, build, static check, spec compliance check, dan security quick scan setelah Agent_CLI selesai, sehingga kualitas perubahan terverifikasi sebelum review.

#### Acceptance Criteria

1. WHEN Worker selesai mendapatkan diff dari Agent_CLI, THE Worker SHALL menjalankan command verification untuk type ∈ {`test`, `lint`, `build`, `static_check`, `spec_compliance`, `security_quick_scan`} secara berurutan di dalam Worktree Execution, dengan setiap command dieksekusi dengan timeout maksimum 1800 detik per command.
2. WHEN setiap command verification selesai, THE Worker SHALL mengirim hasil ke `POST /internal/executions/{id}/verify-result` dengan field `type` ∈ {`test`, `lint`, `build`, `static_check`, `spec_compliance`, `security_quick_scan`}, `command` (1-2000 karakter), `status` ∈ {`passed`, `failed`, `skipped`, `timeout`}, `exit_code` (integer 0-255 atau null untuk skipped/timeout), `output` (maksimum 1 MiB tail jika output melebihi batas), dan `duration_ms` (integer ≥ 0).
3. IF salah satu Verification_Result memiliki `status ∈ {failed, timeout}`, THEN THE Backend_API SHALL menetapkan status Ticket menjadi `Waiting Review` dengan field `verification_failed = true` dan daftar `type` yang gagal pada Execution.
4. WHERE field command test, lint, atau build pada Project bernilai kosong, THE Worker SHALL melewati command tersebut dalam waktu maksimum 5 detik dan mengirim Verification_Result dengan `status = skipped`, `exit_code = null`, dan `output` yang menjelaskan alasan skip.
5. WHEN User memanggil `POST /api/executions/{execution}/verify`, THE Backend_API SHALL men-trigger ulang command Verification untuk Execution tersebut melalui Worker dan mengembalikan kode HTTP 202 dalam waktu maksimum 2 detik.
6. IF User memanggil `POST /api/executions/{execution}/verify` saat Verification untuk Execution tersebut sedang berjalan, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 409 untuk mencegah eksekusi duplikat.

### Requirement 20: Commit Approved Changes ke Branch Baru

**User Story:** Sebagai developer, saya ingin meng-commit perubahan yang disetujui ke branch baru pada repositori Project, sehingga hasil agent dapat ditinjau lebih lanjut melalui workflow Git standar.

#### Acceptance Criteria

1. WHEN User terotentikasi yang merupakan pemilik Project memanggil `POST /api/tickets/{ticket}/commit` untuk Ticket dengan status `Approved`, THE Commit_Service SHALL menjalankan `git add` pada daftar File_Change yang `review_status = approved` di Worktree Execution terbaru milik Ticket dengan timeout maksimum 60 detik.
2. WHEN proses staging selesai dan minimal satu File_Change berhasil di-stage, THE Commit_Service SHALL menjalankan `git commit` dengan message yang berisi judul Ticket dan referensi `ticket-{ticket_id}` dalam waktu maksimum 30 detik.
3. IF tidak ada File_Change dengan `review_status = approved` saat commit dipicu, THEN THE Commit_Service SHALL menolak permintaan dengan kode HTTP 422 dan pesan yang menyatakan tidak ada perubahan disetujui, tanpa membuat commit.
4. IF User memanggil endpoint commit pada Ticket dengan status di luar `Approved`, THEN THE Commit_Service SHALL menolak permintaan dengan kode HTTP 409 tanpa menjalankan operasi Git.
5. THE Commit_Service SHALL tidak menjalankan `git push` secara otomatis tanpa permintaan eksplisit User melalui endpoint terpisah.
6. IF `git add` atau `git commit` mengembalikan exit code bukan 0 atau melebihi timeout, THEN THE Commit_Service SHALL membatalkan operasi (membersihkan staging area dengan `git reset` jika diperlukan) dan mengembalikan kode HTTP 500 beserta stderr Git setelah memfilter token autentikasi remote dan path SSH key.
7. THE Worker SHALL tidak pernah memanggil `git commit` atau `git push` selama Execution berjalan.

### Requirement 21: Agent Configuration dan Provider Settings

**User Story:** Sebagai developer, saya ingin mengelola konfigurasi Agent (provider, model, base URL, API key, timeout, allowed commands), sehingga setiap Project dapat menggunakan Agent yang sesuai.

#### Acceptance Criteria

1. WHEN User membuat Agent baru melalui endpoint Backend_API dengan payload berisi field `name` (1-100 karakter), `type`, `provider`, `model` (1-200 karakter), `base_url` (1-500 karakter, opsional untuk provider yang tidak memerlukan endpoint kustom), dan `config_json` (objek JSON valid yang memuat sub-field `api_key`, `timeout_seconds`, dan `allowed_commands`), THE Backend_API SHALL menyimpan seluruh field tersebut ke tabel `agents` dan mengembalikan response sukses berisi `agent_id` yang baru dibuat.
2. IF payload pembuatan Agent tidak menyertakan salah satu field wajib (`name`, `type`, `provider`, `model`, `config_json`) atau field tersebut bernilai kosong/null, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 400 dan pesan yang mengindikasikan field mana yang hilang atau invalid, tanpa membuat record di tabel `agents`.
3. THE Backend_API SHALL mendukung nilai `provider` hanya pada himpunan {`openai_compatible`, `omniroute`, `anthropic`, `gemini`, `ollama_local`, `custom_endpoint`}.
4. IF User mengirim nilai `provider` di luar himpunan yang didukung, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 400 dan pesan yang mengindikasikan provider tidak valid beserta daftar nilai yang diizinkan, tanpa menyimpan data ke tabel `agents`.
5. THE Backend_API SHALL memvalidasi `timeout_seconds` di dalam `config_json` berada pada rentang 1 sampai 600 detik (inklusif), dan menolak permintaan dengan kode HTTP 400 jika nilai berada di luar rentang tersebut.
6. WHEN Frontend menampilkan Agent yang sudah disimpan dan nilai API key memiliki panjang lebih dari atau sama dengan 4 karakter, THE Frontend SHALL me-mask field API key di dalam `config_json` sehingga hanya 4 karakter terakhir yang terlihat dan karakter sebelumnya diganti dengan karakter mask.
7. IF nilai API key memiliki panjang kurang dari 4 karakter, THEN THE Frontend SHALL me-mask seluruh karakter API key tanpa menampilkan karakter asli apapun.
8. THE Backend_API SHALL tidak menyertakan nilai API key Agent (dalam bentuk plaintext) pada log aplikasi maupun response endpoint apapun, termasuk pada response endpoint pembacaan Agent yang harus mengembalikan API key dalam bentuk ter-mask sesuai aturan kriteria 6 dan 7.
9. THE Backend_API SHALL menerima paling banyak satu Agent dengan `is_default = true` per User.
10. IF User mencoba menyimpan Agent dengan `is_default = true` saat User tersebut sudah memiliki Agent lain dengan `is_default = true`, THEN THE Backend_API SHALL menolak permintaan dengan kode HTTP 409 dan pesan yang menyatakan default agent harus diturunkan terlebih dahulu pada Agent sebelumnya, tanpa mengubah data Agent existing.
11. WHERE Project memiliki agent default, WHEN Ticket baru dibuat di dalam Project tersebut, THE Backend_API SHALL meneruskan `agent_id` default tersebut sebagai pilihan awal pada Ticket yang dibuat.

### Requirement 22: Sandbox Command Allowlist

**User Story:** Sebagai DevOps engineer, saya ingin Worker hanya mengeksekusi command yang ada pada allowlist, sehingga Agent_CLI tidak dapat menjalankan command berbahaya pada host.

#### Acceptance Criteria

1. WHEN Worker startup, THE Worker SHALL membaca allowlist command dari konfigurasi Worker yang berisi daftar nama executable yang diizinkan, sebelum Worker menerima task pertama.
2. IF allowlist command tidak ditemukan, kosong, atau gagal di-parse pada saat startup, THEN THE Worker SHALL menghentikan proses startup, menulis entri log dengan level `error` indikasi konfigurasi allowlist tidak valid, dan keluar tanpa menerima task.
3. IF Agent_CLI atau command Verification mencoba menjalankan executable yang tidak ada pada allowlist, THEN THE Worker SHALL menolak eksekusi, mengembalikan error indikasi command tidak diizinkan kepada pemanggil, dan menulis entri log dengan level `error` yang memuat nama executable yang ditolak dan ID Worktree Execution terkait.
4. IF Worker terdeteksi dijalankan oleh PM2 dengan user `root` pada lingkungan Linux atau macOS saat startup, THEN THE Worker SHALL menghentikan proses startup, menulis entri log dengan level `error` indikasi eksekusi sebagai root tidak diizinkan, dan keluar tanpa menerima task.
5. WHEN Worker mengeksekusi command melalui execa, THE Worker SHALL mengeset opsi `cwd` ke path Worktree Execution aktif dan mengabaikan opsi `cwd` apapun yang diminta Agent_CLI.
6. IF Agent_CLI meminta `cwd` yang berada di luar path Worktree Execution aktif, THEN THE Worker SHALL menolak eksekusi command, mengembalikan error indikasi cwd tidak diizinkan kepada Agent_CLI, dan menulis entri log dengan level `error` yang memuat path yang diminta dan ID Worktree Execution terkait.

### Requirement 23: UI Pages MVP

**User Story:** Sebagai developer, saya ingin SpecPilot menyediakan halaman utama yang dibutuhkan untuk alur MVP, sehingga seluruh workflow dapat dilakukan melalui UI.

#### Acceptance Criteria

1. THE Frontend SHALL menyediakan halaman Login, Dashboard, Project List, Project Detail, Spec Requirements, Spec Design, Spec Tasks, Artifact Version History, Ticket Detail, Execution Detail, Diff Review, Agent Settings, Repository Settings, dan User Settings, dengan setiap halaman dapat diakses melalui URL route unik dan dimuat tanpa error rendering dalam waktu maksimum 3 detik pada koneksi normal.
2. WHEN User mengakses halaman selain Login dalam keadaan belum terotentikasi, THE Frontend SHALL melakukan redirect ke halaman Login.
3. WHILE User berada pada halaman terotentikasi, THE Frontend SHALL menampilkan layout konsisten yang terdiri dari top bar (project switcher, branch indicator, status indicator, search field, user menu), left sidebar navigasi yang menautkan ke setiap halaman MVP, main workspace area yang menampilkan konten halaman aktif, right panel kontekstual yang menampilkan informasi terkait konten utama atau disembunyikan jika tidak ada konteks, dan bottom panel terminal/logs yang dapat di-collapse atau expand oleh User.
4. WHEN User pertama kali memuat aplikasi Frontend tanpa preferensi tema yang tersimpan, THE Frontend SHALL menerapkan dark mode sebagai tema default sebelum konten halaman pertama dirender, tanpa menampilkan flash tema terang.
5. THE Frontend MVP build SHALL tidak menyertakan kode halaman Spec Graph maupun halaman Hooks dalam bundle yang dideploy.
6. IF User mengakses URL halaman Spec Graph atau halaman Hooks pada MVP build, THEN THE Frontend SHALL mengembalikan respons HTTP 404 dengan halaman not-found indicator.

### Requirement 24: Out-of-Scope Phase 2 Features

**User Story:** Sebagai project owner, saya ingin SpecPilot MVP tidak memuat fitur Phase 2, sehingga ruang lingkup pengiriman tetap fokus.

#### Acceptance Criteria

1. THE SpecPilot MVP SHALL tidak menyediakan antarmuka pengguna, endpoint API, perintah CLI, maupun mekanisme pengaktifan (feature flag, konfigurasi, atau menu tersembunyi) untuk fitur Phase 2 berikut: Agent Hooks, Spec Graph, Marketplace Agent, Multi-tenant Enterprise, Collaborative Editing Realtime, Visual Workflow Builder, Deployment Otomatis ke Production, Billing/Subscription, Advanced RBAC, Mobile App Native, dan Spec Categorization (kategori Spec untuk membedakan workflow Feature, Bugfix, atau Quick Plan beserta template prompt requirements/design/tasks yang berbeda per kategori).
2. WHERE PRD menyebut event hook (`before_spec_generate`, `after_spec_generate`, `before_task_execute`, `after_task_execute`, `before_commit`, `after_commit`, `verification_failed`, `ticket_approved`), THE Backend_API SHALL tidak menyediakan endpoint, listener, atau pemicu hook untuk event tersebut pada build MVP, dan setiap event yang dihasilkan secara internal SHALL diabaikan tanpa memanggil handler eksternal.
3. IF klien mengirim permintaan ke endpoint atau memanggil identifier fitur Phase 2 sebagaimana tercantum pada kriteria 1 dan 2, THEN THE Backend_API SHALL menolak permintaan dalam waktu maksimal 2 detik dengan respons error yang mengindikasikan fitur tidak tersedia pada MVP, tidak melakukan perubahan state pada data sistem, dan mencatat penolakan tersebut pada audit log.
4. THE SpecPilot MVP SHALL menyertakan daftar fitur Phase 2 yang dikecualikan beserta status "out-of-scope" pada dokumen catatan rilis MVP, mencakup minimal seluruh 11 fitur pada kriteria 1 dan seluruh 8 event hook pada kriteria 2, sehingga tim QA dapat memverifikasi cakupan pengujian terhadap daftar tersebut.
5. THE tabel `specs` pada Database SHALL tidak memiliki kolom `spec_type` atau kolom serupa yang membedakan jenis Spec (feature/bugfix/quick_plan), dan THE LLM_Service SHALL menggunakan satu set template prompt tunggal per tipe Artifact (requirements/design/tasks) yang ditetapkan pada Requirement 5, 6, dan 7, tanpa pemilihan template berdasarkan kategori Spec.
