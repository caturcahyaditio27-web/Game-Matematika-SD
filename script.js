/* ============================================================
   PETUALANGAN KEBUN ANGKA — script.js
   Game edukasi matematika untuk anak SD kelas 1–2
   ============================================================ */

// =============================================
// KONFIGURASI LEVEL
// =============================================
const LEVEL_CONFIG = {
  1: {
    label: 'Kelas 1',
    operasi: ['tambah'],           // hanya penjumlahan
    maks: 20,                      // bilangan hasil ≤ 20
    rentangA: [1, 10],             // rentang angka pertama
  },
  2: {
    label: 'Kelas 2',
    operasi: ['tambah', 'kurang'], // penjumlahan & pengurangan
    maks: 50,
    rentangA: [1, 40],
  },
};

const TOTAL_SOAL = 10; // jumlah soal per ronde

// =============================================
// EMOJI ILUSTRASI VISUAL (buah & bintang)
// =============================================
const EMOJI_VISUAL = ['🍎', '🍊', '🍋', '🍇', '🍓', '⭐', '🌸', '🏀', '🦋', '🐝'];

// =============================================
// PESAN UMPAN BALIK
// =============================================
const PESAN_BENAR = [
  '🎉 Hebat! Jawabanmu tepat!',
  '✨ Luar biasa! Kamu pintar sekali!',
  '🌟 Sempurna! Terus semangat!',
  '👏 Bravo! Kamu berhasil!',
  '🥳 Yeay! Betul sekali!',
];

const PESAN_SALAH = [
  '💪 Hampir tepat! Coba hitung lagi pelan-pelan ya.',
  '😊 Jangan menyerah! Yuk coba soal berikutnya.',
  '🌈 Tidak apa-apa, kita belajar bersama!',
  '🐢 Pelan-pelan pasti bisa! Yuk lanjut!',
];

const PESAN_HASIL = [
  { min: 0,  max: 3,  teks: '😊 Terus berlatih ya! Setiap hari pasti makin pintar.', bintang: 1 },
  { min: 4,  max: 6,  teks: '👍 Bagus! Kamu sudah cukup pintar. Latihan lagi untuk jadi lebih hebat!', bintang: 2 },
  { min: 7,  max: 10, teks: '🏆 Luar biasa! Kamu juara kebun angka hari ini!', bintang: 3 },
];

// =============================================
// STATE PERMAINAN
// =============================================
let state = {
  level: 1,           // level aktif (1 atau 2)
  soalIndex: 0,       // indeks soal saat ini (0–9)
  skor: 0,            // skor akumulatif
  benar: 0,           // jumlah jawaban benar
  salah: 0,           // jumlah jawaban salah
  riwayat: [],        // 'benar' | 'salah' per soal
  soalSekarang: null, // objek soal aktif
  sudahJawab: false,  // kunci anti-klik ganda
  muted: false,       // status suara
  emojiPilihan: '🍎', // emoji visual untuk ronde ini
};

// =============================================
// WEB AUDIO API — efek suara sederhana
// =============================================
let audioCtx = null;

/** Inisialisasi AudioContext (lazy, butuh interaksi pengguna) */
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Putar nada sederhana menggunakan osilator
 * @param {number} frekuensi - Hz
 * @param {number} durasi    - detik
 * @param {'sine'|'square'|'triangle'} bentuk
 * @param {number} volume    - 0.0 – 1.0
 */
function putarNada(frekuensi, durasi, bentuk = 'sine', volume = 0.3) {
  if (state.muted) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = bentuk;
    osc.frequency.setValueAtTime(frekuensi, ctx.currentTime);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durasi);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durasi);
  } catch (e) {
    // Browser mungkin memblokir audio — abaikan dengan aman
  }
}

/** Efek suara jawaban benar (nada naik ceria) */
function suaraBenar() {
  putarNada(523, 0.12, 'sine', 0.3);  // C5
  setTimeout(() => putarNada(659, 0.12, 'sine', 0.3), 100); // E5
  setTimeout(() => putarNada(784, 0.2,  'sine', 0.3), 200); // G5
}

/** Efek suara jawaban salah (nada rendah serak) */
function suaraSalah() {
  putarNada(220, 0.15, 'square', 0.2); // A3
  setTimeout(() => putarNada(196, 0.25, 'square', 0.15), 120); // G3
}

/** Efek suara tombol klik */
function suaraKlik() {
  putarNada(440, 0.08, 'triangle', 0.15);
}

/** Efek suara ronde selesai */
function suaraSelesai(bintang) {
  const melodi = bintang >= 3
    ? [523, 659, 784, 1047]  // fanfare 3 bintang
    : [440, 494, 523];       // melodi pendek
  melodi.forEach((f, i) => setTimeout(() => putarNada(f, 0.18, 'sine', 0.25), i * 160));
}

// =============================================
// UTILITAS
// =============================================

/** Bilangan acak inklusif antara min–max */
function acak(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/** Ambil elemen acak dari array */
function acakDari(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Ambil pesan acak dari array */
function pesanAcak(arr) {
  return acakDari(arr);
}

// =============================================
// PEMBUATAN SOAL
// =============================================

/**
 * Buat satu soal berdasarkan level.
 * Pengurangan dijamin selalu hasilkan bilangan bulat positif (≥ 1).
 * @returns {{ a, b, operasi, jawaban, teks }}
 */
function buatSoal(level) {
  const cfg = LEVEL_CONFIG[level];
  const operasi = acakDari(cfg.operasi);

  let a, b, jawaban;

  if (operasi === 'tambah') {
    // Pastikan a + b ≤ maks
    a = acak(cfg.rentangA[0], Math.floor(cfg.maks / 2));
    b = acak(1, cfg.maks - a);
    jawaban = a + b;
  } else {
    // Pengurangan: hasilkan a - b ≥ 1 (tidak pernah nol atau minus)
    b = acak(1, Math.floor(cfg.maks / 2));
    a = acak(b + 1, Math.min(cfg.maks, b + 40)); // a > b, tapi tidak terlalu besar
    jawaban = a - b;
  }

  const simbolOp = operasi === 'tambah' ? '+' : '−';
  return {
    a,
    b,
    operasi,
    jawaban,
    teks: `${a}  ${simbolOp}  ${b}  =  ?`,
  };
}

/**
 * Hasilkan 4 pilihan jawaban: 1 benar + 3 pengecoh unik.
 * Pengecoh tidak akan bernilai negatif.
 * @param {number} benar - jawaban yang benar
 * @returns {number[]} - array 4 angka diacak urutannya
 */
function buatPilihan(benar) {
  const set = new Set([benar]);
  const rentang = Math.max(5, Math.floor(benar * 0.5) + 3);

  while (set.size < 4) {
    let variasi = benar + acak(-rentang, rentang);
    if (variasi !== benar && variasi >= 1) {
      set.add(variasi);
    }
  }

  // Acak urutan pilihan
  return [...set].sort(() => Math.random() - 0.5);
}

// =============================================
// RENDER ILUSTRASI VISUAL
// =============================================

/**
 * Tampilkan emoji visual sesuai nilai angka.
 * Dibatasi maks 20 ikon agar tidak terlalu penuh di layar.
 */
function renderVisual(soal) {
  const area = document.getElementById('visualArea');
  area.innerHTML = '';

  const emoji = state.emojiPilihan;
  const jmlA = Math.min(soal.a, 20);
  const jmlB = Math.min(soal.b, 20);

  // Kelompok A
  const grupA = document.createElement('span');
  grupA.className = 'visual-group';
  grupA.setAttribute('aria-label', `${soal.a} ${emoji}`);
  grupA.textContent = emoji.repeat(jmlA);

  // Pemisah
  const sep = document.createElement('span');
  sep.className = 'visual-sep';
  sep.textContent = soal.operasi === 'tambah' ? '➕' : '➖';
  sep.style.fontSize = '1.5rem';

  // Kelompok B
  const grupB = document.createElement('span');
  grupB.className = 'visual-group';
  grupB.setAttribute('aria-label', `${soal.b} ${emoji}`);
  grupB.textContent = emoji.repeat(jmlB);

  area.appendChild(grupA);
  area.appendChild(sep);
  area.appendChild(grupB);
}

// =============================================
// RENDER TITIK PROGRESS
// =============================================
function renderProgressDots() {
  const container = document.getElementById('progressDots');
  container.innerHTML = '';

  for (let i = 0; i < TOTAL_SOAL; i++) {
    const dot = document.createElement('div');
    dot.className = 'progress-dot';

    if (i < state.soalIndex) {
      dot.classList.add(state.riwayat[i] === 'benar' ? 'correct' : 'wrong');
      dot.textContent = state.riwayat[i] === 'benar' ? '✓' : '✗';
    } else if (i === state.soalIndex) {
      dot.classList.add('current');
    }

    container.appendChild(dot);
  }
}

// =============================================
// TAMPIL SOAL BARU
// =============================================
function tampilSoal() {
  const soal = buatSoal(state.level);
  state.soalSekarang = soal;
  state.sudahJawab = false;

  // Perbarui teks soal
  document.getElementById('questionText').textContent = soal.teks;

  // Render visual
  renderVisual(soal);

  // Perbarui progress bar
  const persen = (state.soalIndex / TOTAL_SOAL) * 100;
  document.getElementById('progressFill').style.width = persen + '%';

  // Perbarui counter soal
  document.getElementById('questionCounter').textContent =
    `Soal ${state.soalIndex + 1} / ${TOTAL_SOAL}`;

  // Render titik progress
  renderProgressDots();

  // Buat 4 pilihan jawaban
  const pilihan = buatPilihan(soal.jawaban);
  const tombolArr = document.querySelectorAll('.answer-btn');

  tombolArr.forEach((btn, i) => {
    btn.textContent = pilihan[i];
    btn.dataset.nilai = pilihan[i];
    btn.className = 'answer-btn'; // reset state visual
    btn.disabled = false;
  });

  // Sembunyikan tombol "Soal Berikutnya"
  document.getElementById('btnNext').classList.add('hidden');

  // Sembunyikan feedback
  const fb = document.getElementById('feedbackBanner');
  fb.className = 'feedback-banner';
  fb.textContent = '';
}

// =============================================
// PROSES JAWABAN
// =============================================

/**
 * Panggil saat anak memilih salah satu tombol jawaban.
 * Mencegah klik ganda dengan flag state.sudahJawab.
 */
function prosesJawaban(nilaiDipilih, tombolDipilih) {
  if (state.sudahJawab) return; // anti klik ganda
  state.sudahJawab = true;

  const benar = state.soalSekarang.jawaban;
  const isBenar = parseInt(nilaiDipilih) === benar;

  // Kunci semua tombol jawaban
  document.querySelectorAll('.answer-btn').forEach((btn) => {
    btn.disabled = true;
    // Tandai jawaban benar (selalu ditampilkan hijau)
    if (parseInt(btn.dataset.nilai) === benar) {
      btn.classList.add('benar');
    }
  });

  if (isBenar) {
    // Jawaban benar
    tombolDipilih.classList.remove('salah');
    tombolDipilih.classList.add('benar');
    state.skor += 10;
    state.benar++;
    state.riwayat.push('benar');

    // Feedback benar
    tampilFeedback(pesanAcak(PESAN_BENAR), 'benar');
    suaraBenar();
    lemparEmoji('✨', tombolDipilih);
  } else {
    // Jawaban salah
    tombolDipilih.classList.add('salah');
    state.salah++;
    state.riwayat.push('salah');

    // Goyangkan kartu soal
    const qCard = document.querySelector('.question-card');
    qCard.classList.remove('shake');
    void qCard.offsetWidth; // reflow untuk reset animasi
    qCard.classList.add('shake');
    setTimeout(() => qCard.classList.remove('shake'), 450);

    // Feedback salah
    tampilFeedback(pesanAcak(PESAN_SALAH), 'salah');
    suaraSalah();
  }

  // Perbarui skor di topbar
  document.getElementById('scoreValue').textContent = state.skor;

  // Tampilkan tombol lanjut
  const btnNext = document.getElementById('btnNext');
  btnNext.classList.remove('hidden');

  // Jika soal terakhir, ubah label tombol
  if (state.soalIndex === TOTAL_SOAL - 1) {
    btnNext.textContent = 'Lihat Hasil 🏆';
  } else {
    btnNext.textContent = 'Soal Berikutnya ➡️';
  }
}

// =============================================
// TAMPIL FEEDBACK
// =============================================
function tampilFeedback(pesan, tipe) {
  const fb = document.getElementById('feedbackBanner');
  fb.textContent = pesan;
  fb.className = `feedback-banner ${tipe} show`;
}

// =============================================
// LANJUT KE SOAL BERIKUTNYA
// =============================================
function soalBerikutnya() {
  suaraKlik();
  state.soalIndex++;

  if (state.soalIndex >= TOTAL_SOAL) {
    tampilHasil();
  } else {
    tampilSoal();
  }
}

// =============================================
// TAMPIL LAYAR HASIL AKHIR
// =============================================
function tampilHasil() {
  gantilayar('screenResult');

  // Hitung bintang
  const data = PESAN_HASIL.find(
    (p) => state.benar >= p.min && state.benar <= p.max
  );
  const bintang = data ? data.bintang : 1;

  // Render bintang
  const starsDiv = document.getElementById('starsDisplay');
  starsDiv.innerHTML = '';
  for (let i = 1; i <= 3; i++) {
    const s = document.createElement('span');
    s.className = 'star-icon' + (i <= bintang ? ' active' : '');
    s.textContent = '⭐';
    // Delay animasi per bintang
    if (i <= bintang) {
      s.style.animationDelay = `${(i - 1) * 0.2}s`;
    }
    starsDiv.appendChild(s);
  }

  // Isi statistik
  document.getElementById('finalScore').textContent = state.skor;
  document.getElementById('finalCorrect').textContent = state.benar;
  document.getElementById('finalWrong').textContent = state.salah;

  // Judul & pesan
  document.getElementById('resultTitle').textContent =
    bintang === 3 ? '🏆 Sempurna! Kamu Juara!' : '🎉 Ronde Selesai!';
  document.getElementById('resultMessage').textContent = data ? data.teks : '';

  suaraSelesai(bintang);
}

// =============================================
// MULAI RONDE BARU (level sama)
// =============================================
function mulaiRonde(level) {
  state.level = level;
  state.soalIndex = 0;
  state.skor = 0;
  state.benar = 0;
  state.salah = 0;
  state.riwayat = [];
  state.sudahJawab = false;
  state.emojiPilihan = acakDari(EMOJI_VISUAL); // pilih emoji baru tiap ronde

  // Tampilkan label level di topbar game
  document.getElementById('levelIndicator').textContent = LEVEL_CONFIG[level].label;
  document.getElementById('scoreValue').textContent = '0';

  gantilayar('screenGame');
  tampilSoal();
}

// =============================================
// MANAJEMEN LAYAR
// =============================================

/**
 * Sembunyikan semua layar lalu tampilkan yang diminta.
 * Juga memperbarui state aktif pada item menu navigasi.
 * @param {string} idLayar - id elemen <main> yang akan ditampilkan
 */
function gantilayar(idLayar) {
  // Sembunyikan semua layar
  document.querySelectorAll('.screen').forEach((s) => s.classList.remove('active'));
  document.getElementById(idLayar).classList.add('active');

  // Perbarui kelas aktif pada nav desktop
  document.querySelectorAll('.nav-link').forEach((link) => {
    const target = link.dataset.target;
    // Tombol "Beranda" dan "Pilih Level" keduanya mengarah ke screenLevel
    if (target === idLayar) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Perbarui kelas aktif pada nav mobile
  document.querySelectorAll('.nav-mobile-link').forEach((link) => {
    const target = link.dataset.target;
    if (target === idLayar) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Tutup menu mobile jika terbuka
  tutupMenuMobile();
}

// =============================================
// HAMBURGER MENU MOBILE
// =============================================

/** Buka/tutup menu mobile */
function toggleMenuMobile() {
  const hamburger = document.getElementById('btnHamburger');
  const navMobile = document.getElementById('navMobile');
  const isTerbuka = hamburger.classList.contains('open');

  if (isTerbuka) {
    tutupMenuMobile();
  } else {
    hamburger.classList.add('open');
    hamburger.setAttribute('aria-expanded', 'true');
    navMobile.classList.add('open');
    navMobile.setAttribute('aria-hidden', 'false');
  }
}

/** Tutup menu mobile */
function tutupMenuMobile() {
  const hamburger = document.getElementById('btnHamburger');
  const navMobile = document.getElementById('navMobile');
  hamburger.classList.remove('open');
  hamburger.setAttribute('aria-expanded', 'false');
  navMobile.classList.remove('open');
  navMobile.setAttribute('aria-hidden', 'true');
}

// =============================================
// EFEK EMOJI TERBANG
// =============================================

/**
 * Lempar emoji muncul di dekat tombol yang diklik (hanya saat benar).
 * @param {string} emoji
 * @param {HTMLElement} elemen - acuan posisi
 */
function lemparEmoji(emoji, elemen) {
  const rect = elemen.getBoundingClientRect();
  for (let i = 0; i < 4; i++) {
    const el = document.createElement('span');
    el.className = 'emoji-fly';
    el.textContent = acakDari(['⭐', '✨', '🎉', '🌟', '🎊']);
    el.style.left = (rect.left + acak(-20, rect.width + 20)) + 'px';
    el.style.top  = (rect.top + window.scrollY + acak(0, 20)) + 'px';
    el.style.animationDelay = (i * 0.08) + 's';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1200);
  }
}

// =============================================
// EVENT LISTENERS
// =============================================

/** Pasang semua event listener setelah DOM siap */
document.addEventListener('DOMContentLoaded', () => {

  // --- Tombol pilih level (dari layar level) ---
  document.querySelectorAll('.level-card').forEach((btn) => {
    btn.addEventListener('click', () => {
      suaraKlik();
      const level = parseInt(btn.dataset.level);
      mulaiRonde(level);
    });
  });

  // --- Tombol jawaban ---
  document.querySelectorAll('.answer-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!btn.disabled) {
        prosesJawaban(btn.dataset.nilai, btn);
      }
    });
  });

  // --- Tombol soal berikutnya ---
  document.getElementById('btnNext').addEventListener('click', soalBerikutnya);

  // --- Tombol main lagi (level sama) ---
  document.getElementById('btnPlayAgain').addEventListener('click', () => {
    suaraKlik();
    mulaiRonde(state.level);
  });

  // --- Tombol kembali ke pilih level (dari layar hasil) ---
  document.getElementById('btnBackToLevel').addEventListener('click', () => {
    suaraKlik();
    gantilayar('screenLevel');
  });

  // --- Tombol ganti level (di dalam layar game) ---
  document.getElementById('btnChangeLevel').addEventListener('click', () => {
    suaraKlik();
    gantilayar('screenLevel');
  });

  // --- Tombol mulai bermain (dari layar cara bermain) ---
  document.getElementById('btnStartFromHelp').addEventListener('click', () => {
    suaraKlik();
    gantilayar('screenLevel');
  });

  // --- Tombol mute ---
  const btnMute = document.getElementById('btnMute');
  btnMute.addEventListener('click', () => {
    state.muted = !state.muted;
    btnMute.textContent = state.muted ? '🔇' : '🔊';
    btnMute.title = state.muted ? 'Nyalakan suara' : 'Matikan suara';
  });

  // --- Menu navigasi desktop: klik item menu ---
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', () => {
      suaraKlik();
      const target = link.dataset.target;
      gantilayar(target);
    });
  });

  // --- Menu navigasi mobile: klik item menu ---
  document.querySelectorAll('.nav-mobile-link').forEach((link) => {
    link.addEventListener('click', () => {
      suaraKlik();
      const target = link.dataset.target;
      gantilayar(target);
    });
  });

  // --- Tombol hamburger (mobile) ---
  document.getElementById('btnHamburger').addEventListener('click', toggleMenuMobile);

  // --- Tutup menu mobile saat klik di luar area header ---
  document.addEventListener('click', (e) => {
    const header = document.querySelector('.app-header');
    if (!header.contains(e.target)) {
      tutupMenuMobile();
    }
  });

  // --- Tampilkan layar awal ---
  gantilayar('screenLevel');
});
