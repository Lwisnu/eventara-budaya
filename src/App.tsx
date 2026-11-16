import { useEffect, useMemo, useState } from 'react';
import OrganizerPortal from './OrganizerPortal';
import { api } from '@appdeploy/client';
import {
  Search,
  SlidersHorizontal,
  MapPin,
  CalendarDays,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Music2,
  Palette,
  Umbrella,
  Theater,
  BookOpen,
  Sparkles,
  Menu,
  X,
  Clock3,
} from 'lucide-react';

type EventItem = {
  id: number | string;
  title: string;
  category: string;
  date: string;
  startDate: string;
  endDate: string;
  location: string;
  district: string;
  mapLink?: string;
  address?: string;
  format?: string;
  startTime?: string;
  endTime?: string;
  organizerName?: string;
  ticketPrice?: string;
  ticketLink?: string;
  registrationInfo?: string;
  supportingLinks?: string[];
  image: string;
  description: string;
  latitude: number;
  longitude: number;
  ticketType: 'Berbayar' | 'Gratis';
  status?: string;
};

const events: EventItem[] = [
  {
    id: 1,
    title: 'Sendratari Ramayana',
    category: 'Seni pertunjukan',
    date: '12 Sep 2026',
    startDate: '2026-09-12',
    endDate: '2026-09-12',
    location: 'Candi Prambanan, Sleman',
    district: 'Sleman',
    ticketType: 'Berbayar',
    latitude: -7.7520,
    longitude: 110.4915,
    image:
      'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=900&q=85',
    description:
      'Pertunjukan tari dramatik yang menghidupkan kisah Ramayana melalui gerak, musik, dan tata panggung.',
  },
  {
    id: 2,
    title: 'Jogja Batik Festival',
    category: 'Pameran & seni rupa',
    date: '15–20 Sep 2026',
    startDate: '2026-09-15',
    endDate: '2026-09-20',
    location: 'Jogja Expo Center, Bantul',
    district: 'Bantul',
    ticketType: 'Berbayar',
    latitude: -7.8398,
    longitude: 110.3906,
    image:
      'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=85',
    description:
      'Ragam karya batik, proses kreatif, dan cerita di balik tradisi wastra Yogyakarta.',
  },
  {
    id: 3,
    title: 'Grebeg Maulud',
    category: 'Tradisi & upacara',
    date: '28 Sep 2026',
    startDate: '2026-09-28',
    endDate: '2026-09-28',
    location: 'Kraton Yogyakarta',
    district: 'Kota Yogyakarta',
    ticketType: 'Gratis',
    latitude: -7.8053,
    longitude: 110.3642,
    image:
      'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=85',
    description:
      'Tradisi budaya yang menjadi bagian dari kehidupan dan sejarah masyarakat Yogyakarta.',
  },
  {
    id: 4,
    title: 'Malam Gamelan Nusantara',
    category: 'Musik tradisional',
    date: '03 Okt 2026',
    startDate: '2026-10-03',
    endDate: '2026-10-03',
    location: 'Taman Budaya Yogyakarta',
    district: 'Kota Yogyakarta',
    ticketType: 'Berbayar',
    latitude: -7.8014,
    longitude: 110.3671,
    image:
      'https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=900&q=85',
    description:
      'Pertemuan bunyi dan tradisi melalui pertunjukan musik gamelan.',
  },
  {
    id: 5,
    title: 'Pasar Seni dan Kerajinan',
    category: 'Pameran & seni rupa',
    date: '10 Okt 2026',
    startDate: '2026-10-10',
    endDate: '2026-10-10',
    location: 'Taman Budaya, Kulon Progo',
    district: 'Kulon Progo',
    ticketType: 'Gratis',
    latitude: -7.8586,
    longitude: 110.1648,
    image:
      'https://images.unsplash.com/photo-1452860606245-08befc0ff44b?auto=format&fit=crop&w=900&q=85',
    description: 'Pameran karya dan kerajinan dari pelaku kreatif lokal.',
  },
  {
    id: 6,
    title: 'Festival Cerita Rakyat',
    category: 'Sastra & diskusi',
    date: '18 Okt 2026',
    startDate: '2026-10-18',
    endDate: '2026-10-18',
    location: 'Alun-alun Wonosari',
    district: 'Gunungkidul',
    ticketType: 'Gratis',
    latitude: -7.9666,
    longitude: 110.6020,
    image:
      'https://images.unsplash.com/photo-1516307365426-bea591f05011?auto=format&fit=crop&w=900&q=85',
    description: 'Ruang bertemu untuk cerita lisan, sastra, dan tradisi lokal.',
  },
];

const categories = [
  { name: 'Seni pertunjukan', icon: Theater },
  { name: 'Musik tradisional', icon: Music2 },
  { name: 'Pameran & seni rupa', icon: Palette },
  { name: 'Tradisi & upacara', icon: Umbrella },
  { name: 'Festival & kirab', icon: Sparkles },
  { name: 'Workshop budaya', icon: Clock3 },
  { name: 'Sastra & diskusi', icon: BookOpen },
];
function App() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Semua');
  const [region, setRegion] = useState('Semua wilayah');
  const [datePeriod, setDatePeriod] = useState('Semua waktu');
  const [ticketType, setTicketType] = useState('Semua jenis');
  const [currentPage, setCurrentPage] = useState(1);
  const eventsPerPage = 10;
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [showOrganizerPortal, setShowOrganizerPortal] = useState(false);
  const [publishedEvents, setPublishedEvents] = useState<EventItem[]>([]);
  const [archivedEvents, setArchivedEvents] = useState<EventItem[]>([]);

  useEffect(() => {
    let active = true;
    api.get('/api/public/events').then(response => {
      const rows = response.data.events as Array<{ id: string; title: string; category: string; description: string; startDate: string; endDate: string; startTime?: string; endTime?: string; venue: string; address?: string; district: string; latitude?: number | null; longitude?: number | null; format?: string; mapLink?: string; organizerName?: string; ticketType: 'Gratis' | 'Berbayar'; ticketPrice?: string; ticketLink?: string; registrationInfo?: string; supportingLinks?: string[]; posterUrl?: string; posterContentType?: string }>;
      if (!active) return;
      setPublishedEvents(rows.map(row => {
        const formatDate = (value: string) => value ? new Date(value + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Jadwal menyusul';
        const isImage = row.posterContentType === 'image/jpeg' || row.posterContentType === 'image/png';
        return {
          id: row.id, title: row.title, category: row.category, date: row.startDate === row.endDate ? formatDate(row.startDate) : formatDate(row.startDate) + ' – ' + formatDate(row.endDate),
          startDate: row.startDate, endDate: row.endDate, location: [row.venue, row.district].filter(Boolean).join(', '), district: row.district || '', mapLink: row.mapLink || '',
          address: row.address || '', format: row.format || '', startTime: row.startTime || '', endTime: row.endTime || '',
          organizerName: row.organizerName || '', ticketPrice: row.ticketPrice || '', ticketLink: row.ticketLink || '',
          registrationInfo: row.registrationInfo || '', supportingLinks: row.supportingLinks || [],
          image: isImage && row.posterUrl ? row.posterUrl : 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=85',
          description: row.description, latitude: Number(row.latitude ?? 0), longitude: Number(row.longitude ?? 0), ticketType: row.ticketType,
        };
      }));
    }).catch(() => { /* Keep the sample catalog visible if the submission service is unavailable. */ });
    api.get('/api/public/events/archive').then(response => {
      const rows = response.data.events as Array<{ id: string; title: string; category: string; description: string; startDate: string; endDate: string; startTime?: string; endTime?: string; venue: string; address?: string; district: string; format?: string; mapLink?: string; organizerName?: string; ticketType: 'Gratis' | 'Berbayar'; ticketPrice?: string; ticketLink?: string; registrationInfo?: string; supportingLinks?: string[]; posterUrl?: string; posterContentType?: string; status?: string }>;
      if (!active) return;
      setArchivedEvents(rows.map(row => {
        const formatDate = (value: string) => value ? new Date(value + 'T00:00:00').toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Jadwal menyusul';
        const isImage = row.posterContentType === 'image/jpeg' || row.posterContentType === 'image/png';
        return {
          id: row.id, title: row.title, category: row.category, date: row.startDate === row.endDate ? formatDate(row.startDate) : formatDate(row.startDate) + ' – ' + formatDate(row.endDate),
          startDate: row.startDate, endDate: row.endDate, location: [row.venue, row.district].filter(Boolean).join(', '), district: row.district || '', mapLink: row.mapLink || '',
          address: row.address || '', format: row.format || '', startTime: row.startTime || '', endTime: row.endTime || '',
          organizerName: row.organizerName || '', ticketPrice: row.ticketPrice || '', ticketLink: row.ticketLink || '',
          registrationInfo: row.registrationInfo || '', supportingLinks: row.supportingLinks || [],
          image: isImage && row.posterUrl ? row.posterUrl : 'https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=900&q=85',
          description: row.description, latitude: 0, longitude: 0, ticketType: row.ticketType, status: row.status || 'published',
        };
      }));
    }).catch(() => { /* Archive remains empty if the archive service is unavailable. */ });
    return () => { active = false; };
  }, []);

  const allEvents = useMemo(() => [...events, ...publishedEvents], [publishedEvents]);
  const heroSlides = useMemo(() => {
    const availablePosters = publishedEvents
      .filter(event => Boolean(event.image))
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    return (availablePosters.length ? availablePosters : events).slice(0, 5);
  }, [publishedEvents]);
  const activeHeroSlide = heroSlides[carouselIndex % heroSlides.length] || events[0];

  useEffect(() => {
    setCarouselIndex(0);
  }, [heroSlides.length]);

  useEffect(() => {
    if (heroSlides.length <= 1) return;
    const interval = window.setInterval(() => {
      setCarouselIndex(current => (current + 1) % heroSlides.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [heroSlides.length]);

  const filtered = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const toLocalDate = (value: string) => {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    };
    const periodStart = datePeriod === 'Hari ini' ? today : datePeriod === 'Minggu ini' ? weekStart : datePeriod === 'Bulan ini' ? monthStart : null;
    const periodEnd = datePeriod === 'Hari ini' ? today : datePeriod === 'Minggu ini' ? weekEnd : datePeriod === 'Bulan ini' ? monthEnd : null;
    return allEvents.filter(event => {
        if (event.endDate && event.endDate < `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`) return false;
        const matchesQuery = (
          event.title +
          ' ' +
          event.category +
          ' ' +
          event.location
        )
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesCategory =
          category === 'Semua' || event.category === category;
        const matchesRegion =
          region === 'Semua wilayah' ||
          event.district === region ||
          event.location.includes(region.replace('Kab. ', ''));
        const matchesTicketType = ticketType === 'Semua jenis' || event.ticketType === ticketType;
        const eventStart = toLocalDate(event.startDate);
        const eventEnd = toLocalDate(event.endDate);
        const matchesPeriod = !periodStart || !periodEnd || (eventStart <= periodEnd && eventEnd >= periodStart);
        return matchesQuery && matchesCategory && matchesRegion && matchesPeriod && matchesTicketType;
      }).sort((a, b) => {
        const aStart = toLocalDate(a.startDate).getTime();
        const bStart = toLocalDate(b.startDate).getTime();
        const todayTime = today.getTime();
        const aActive = toLocalDate(a.startDate) <= today && toLocalDate(a.endDate) >= today;
        const bActive = toLocalDate(b.startDate) <= today && toLocalDate(b.endDate) >= today;
        if (aActive !== bActive) return aActive ? -1 : 1;
        const aDistance = aStart >= todayTime ? aStart - todayTime : Number.MAX_SAFE_INTEGER;
        const bDistance = bStart >= todayTime ? bStart - todayTime : Number.MAX_SAFE_INTEGER;
        return aDistance - bDistance || aStart - bStart;
      });
  }, [query, category, region, datePeriod, ticketType, allEvents]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / eventsPerPage));
  const visibleEvents = filtered.slice((currentPage - 1) * eventsPerPage, currentPage * eventsPerPage);
  const nearbyEvents = useMemo(() => {
    if (!userLocation) return [];
    const now = new Date();
    const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const radians = (degrees: number) => (degrees * Math.PI) / 180;
    return allEvents.filter(event => event.endDate >= todayIso && Number.isFinite(event.latitude) && Number.isFinite(event.longitude) && (event.latitude !== 0 || event.longitude !== 0) && event.format !== 'Daring').map(event => {
      const dLat = radians(event.latitude - userLocation.latitude);
      const dLon = radians(event.longitude - userLocation.longitude);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(userLocation.latitude)) * Math.cos(radians(event.latitude)) * Math.sin(dLon / 2) ** 2;
      return { event, distance: 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) };
    }).sort((a, b) => a.distance - b.distance).slice(0, 3);
  }, [userLocation, allEvents]);

  const findNearbyEvents = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Browser ini tidak mendukung akses lokasi. Gunakan filter wilayah di bawah.');
      return;
    }
    setLocating(true);
    setLocationMessage('Meminta izin lokasi perangkat…');
    navigator.geolocation.getCurrentPosition(position => {
      setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocationMessage('Lokasi ditemukan. Acara mendatang diurutkan dari yang terdekat.');
      setLocating(false);
    }, error => {
      setLocating(false);
      setLocationMessage(error.code === error.PERMISSION_DENIED ? 'Izin lokasi tidak diberikan. Kamu tetap bisa mencari acara lewat filter wilayah.' : 'Lokasi belum bisa didapatkan. Coba lagi atau gunakan filter wilayah.');
    }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [query, category, region, datePeriod, ticketType, allEvents]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.min(totalPages, Math.max(1, page)));
    document.getElementById('agenda')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const scrollToEvents = () =>
    document.getElementById('agenda')?.scrollIntoView({ behavior: 'smooth' });

  return (
    <div className="site-shell">
      <header className="navbar">
        <a className="brand" href="#top" aria-label="Eventara Budaya beranda">
          <img className="brand-logo" src="/resources/eventara-logo.png" alt="" aria-hidden="true" />
          <span>
            Eventara <b>Budaya</b>
          </span>
        </a>
        <button
          className="mobile-menu-button"
          aria-label="Buka navigasi"
          onClick={() => setMobileMenu(!mobileMenu)}
        >
          {mobileMenu ? <X /> : <Menu />}
        </button>
        <nav className={mobileMenu ? 'nav-links open' : 'nav-links'}>
          <a
            className="active"
            href="#top"
            onClick={() => setMobileMenu(false)}
          >
            Beranda
          </a>
          <a href="#agenda" onClick={() => setMobileMenu(false)}>
            Agenda
          </a>
          <a href="#arsip" onClick={() => setMobileMenu(false)}>
            Arsip acara
          </a>
          <a href="#ajukan" onClick={() => setMobileMenu(false)}>
            Ajukan Acara
          </a>
        </nav>
        <button
          className="nav-search"
          aria-label="Fokus pencarian"
          onClick={() => {
            document.getElementById('event-search')?.focus();
            scrollToEvents();
          }}
        >
          <Search size={21} />
        </button>
      </header>

      <main id="top">
        <section className="hero">
          <img
            key={String(activeHeroSlide.id)}
            className="hero-image"
            src={activeHeroSlide.image}
            alt=""
            aria-hidden="true"
          />
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow">AGENDA BUDAYA YOGYAKARTA</p>
            <h1>
              Temukan
              <br />
              <span>budaya,</span>
              <br />
              temukan
              <br />
              pengalaman.
            </h1>
            <p className="hero-description">
              Jelajahi berbagai acara budaya di seluruh Yogyakarta, dalam satu
              tempat.
            </p>
          </div>
          <div className="hero-controls">
            <div className="hero-search-column">
              <form
                className="hero-search"
                onSubmit={e => {
                  e.preventDefault();
                  scrollToEvents();
                }}
              >
                <Search size={21} />
                <input
                  id="event-search"
                  aria-label="Cari acara budaya"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Cari acara budaya..."
                />
                <button type="submit" className="search-submit">
                  Cari
                </button>
              </form>
              <button
                className="filter-trigger"
                onClick={() => {
                  setShowFilters(open => !open);
                  scrollToEvents();
                }}
                aria-expanded={showFilters}
                aria-controls="agenda-filters"
              >
                <SlidersHorizontal size={17} /> {showFilters ? 'Tutup filter' : 'Semua filter'}
              </button>
            </div>
            <aside className="nearby-card" aria-label="Cari acara terdekat">
              <div className="nearby-card-heading">
                <span className="nearby-pin"><MapPin size={19} /></span>
                <div>
                  <p className="nearby-kicker">JELAJAHI SEKITARMU</p>
                  <h2>Cari acara terdekat</h2>
                </div>
              </div>
              <p className="nearby-description">Temukan acara budaya yang sedang berlangsung atau akan datang di sekitar lokasimu.</p>
              <button className="nearby-button" onClick={findNearbyEvents} disabled={locating}>
                <MapPin size={16} /> {locating ? 'Mencari lokasi…' : userLocation ? 'Perbarui lokasi saya' : 'Gunakan lokasi saya'}
              </button>
              {locationMessage && <p className="nearby-status" role="status">{locationMessage}</p>}
              {userLocation && nearbyEvents.length > 0 && <div className="nearby-results">{nearbyEvents.map(({ event, distance }) => <button className="nearby-result" key={event.id} onClick={() => setSelected(event)}><span><b>{event.title}</b><small>{event.date}</small></span><strong>{distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`}</strong></button>)}</div>}
              {userLocation && nearbyEvents.length === 0 && <p className="nearby-status">Belum ada acara mendatang dengan koordinat lokasi yang tersedia. Acara tanpa koordinat tetap bisa ditemukan melalui katalog dan filter wilayah.</p>}
            </aside>
          </div>
          <div className="hero-index" aria-label="Navigasi poster acara">
            {heroSlides.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={index === carouselIndex % heroSlides.length ? 'active' : ''}
                aria-label={`Tampilkan poster ${index + 1}`}
                aria-pressed={index === carouselIndex % heroSlides.length}
                onClick={() => setCarouselIndex(index)}
              />
            ))}
          </div>
          <div className="hero-bottom-note">
            BUDAYA HIDUP DI SINI <span>•</span> DAERAH ISTIMEWA YOGYAKARTA
          </div>
        </section>

        <section className="category-strip" aria-label="Kategori acara">
          <div className="category-heading">
            KATEGORI
            <br />
            ACARA
          </div>
          {categories.map(({ name, icon: Icon }) => (
            <button
              key={name}
              className={'category-item ' + (category === name ? 'chosen' : '')}
              onClick={() => {
                setCategory(category === name ? 'Semua' : name);
                scrollToEvents();
              }}
            >
              <Icon size={27} strokeWidth={1.35} />
              <span>{name}</span>
            </button>
          ))}
        </section>

        <section className="events-section" id="agenda">
          {showFilters && <div className="filter-panel" id="agenda-filters">
              <label>
                Kategori
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                >
                  <option>Semua</option>
                  {categories.map(c => (
                    <option key={c.name}>{c.name}</option>
                  ))}
                </select>
              </label>
              <label>
                Waktu acara
                <select
                  value={datePeriod}
                  onChange={e => setDatePeriod(e.target.value)}
                >
                  <option>Semua waktu</option>
                  <option>Hari ini</option>
                  <option>Minggu ini</option>
                  <option>Bulan ini</option>
                </select>
              </label>
              <label>
                Wilayah
                <select
                  value={region}
                  onChange={e => setRegion(e.target.value)}
                >
                  <option>Semua wilayah</option>
                  <option>Kota Yogyakarta</option>
                  <option>Sleman</option>
                  <option>Bantul</option>
                  <option>Kulon Progo</option>
                  <option>Gunungkidul</option>
                </select>
              </label>
              <label>
                Jenis tiket
                <select value={ticketType} onChange={e => setTicketType(e.target.value)}>
                  <option>Semua jenis</option>
                  <option>Berbayar</option>
                  <option>Gratis</option>
                </select>
              </label>
              <button
                className="reset-filter"
                onClick={() => {
                  setCategory('Semua');
                  setRegion('Semua wilayah');
                  setDatePeriod('Semua waktu');
                  setTicketType('Semua jenis');
                  setQuery('');
                }}
              >
                Reset filter
              </button>
          </div>}
          <div className="event-results-note">
            {filtered.length} acara ditemukan <span>•</span> {publishedEvents.length > 0 ? 'Acara terbit dari penyelenggara' : 'Data contoh untuk prototipe'}
          </div>
          {filtered.length ? (
            <div className="event-grid">
              {visibleEvents.map(event => (
                <button
                  className="event-card"
                  key={event.id}
                  onClick={() => setSelected(event)}
                >
                  <div className="event-image-wrap">
                    <img src={event.image} alt="" loading="lazy" />
                    <span className="event-category">{event.category}</span>
                    <span className="event-arrow">
                      <ArrowRight size={18} />
                    </span>
                  </div>
                  <div className="event-info">
                    <h3>{event.title}</h3>
                    <p>
                      <CalendarDays size={14} />
                      {event.date}
                    </p>
                    <p>
                      <MapPin size={14} />
                      {event.location}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <Search size={28} />
              <h3>Belum ada acara yang cocok</h3>
              <p>Coba kata kunci atau filter yang berbeda.</p>
              <button
                onClick={() => {
                  setQuery('');
                  setCategory('Semua');
                  setRegion('Semua wilayah');
                  setDatePeriod('Semua waktu');
                  setTicketType('Semua jenis');
                }}
              >
                Hapus filter
              </button>
            </div>
          )}
          {totalPages > 1 && (
            <nav className="pagination" aria-label="Halaman daftar acara">
              <button className="pagination-arrow" aria-label="Halaman sebelumnya" disabled={currentPage === 1} onClick={() => goToPage(currentPage - 1)}>
                <ChevronLeft size={17} />
              </button>
              {Array.from({ length: totalPages }, (_, index) => index + 1).map(page => (
                <button key={page} className={page === currentPage ? 'pagination-page active' : 'pagination-page'} aria-current={page === currentPage ? 'page' : undefined} onClick={() => goToPage(page)}>
                  {page}
                </button>
              ))}
              <button className="pagination-arrow" aria-label="Halaman berikutnya" disabled={currentPage === totalPages} onClick={() => goToPage(currentPage + 1)}>
                <ChevronRight size={17} />
              </button>
              <span className="pagination-summary">Halaman {currentPage} dari {totalPages}</span>
            </nav>
          )}
        </section>

        <section className="archive-section" id="arsip">
          <div className="section-heading archive-heading"><div><p className="eyebrow">JEJAK KEGIATAN BUDAYA</p><h2>ARSIP <span>ACARA</span></h2><p>Dokumentasi acara budaya yang telah selesai atau dibatalkan.</p></div><span className="archive-count">{archivedEvents.length} acara</span></div>
          {archivedEvents.length ? <div className="event-grid">{archivedEvents.map(event => <button className="event-card archive-event-card" key={event.id} onClick={() => setSelected(event)}><div className="event-image-wrap"><img src={event.image} alt="" loading="lazy" /><span className="event-category">{event.category}</span><span className="archive-ribbon">{event.status === 'cancelled' ? 'Dibatalkan' : 'Selesai'}</span></div><div className="event-info"><h3>{event.title}</h3><p><CalendarDays size={14} />{event.date}</p><p><MapPin size={14} />{event.location}</p></div></button>)}</div> : <div className="archive-empty"><CalendarDays size={25} /><h3>Belum ada acara dalam arsip</h3><p>Acara yang telah selesai dan pernah diterbitkan akan tersimpan di sini.</p></div>}
        </section>

        <section className="organizer-section" id="ajukan">
          <div className="organizer-photo" />
          <div className="organizer-shade" />
          <div className="organizer-copy">
            <p className="eyebrow">PUNYA ACARA BUDAYA?</p>
            <h2>
              Bagikan
              <br />
              <span>ke publik.</span>
            </h2>
            <p>
              Ajukan informasi acara untuk ditinjau dan diterbitkan di Eventara
              Budaya.
            </p>
            <button
              onClick={() => setShowOrganizerPortal(true)}
            >
              Ajukan acara <ArrowRight size={17} />
            </button>
          </div>
        </section>
      </main>

      <footer className="footer">
        <a className="brand" href="#top">
          <img className="brand-logo" src="/resources/eventara-logo.png" alt="" aria-hidden="true" />
          <span>
            Eventara <b>Budaya</b>
          </span>
        </a>
        <p>Katalog acara budaya Daerah Istimewa Yogyakarta.</p>
        <span>Ruang untuk merayakan budaya.</span>
      </footer>

      {showOrganizerPortal && <OrganizerPortal onClose={() => setShowOrganizerPortal(false)} />}

      {selected && (
        <div
          className="modal-backdrop"
          role="presentation"
          onClick={() => setSelected(null)}
        >
          <section
            className="event-modal"
            role="dialog"
            aria-modal="true"
            aria-label={selected.title}
            onClick={e => e.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setSelected(null)}
              aria-label="Tutup"
            >
              <X />
            </button>
            {selected.image && (
              <img className="modal-image" src={selected.image} alt="" />
            )}
            <div className="modal-content">
              <p className="eyebrow">{selected.category}</p>
              {selected.status === 'cancelled' && <div className="portal-alert error" role="status">Acara ini telah dibatalkan oleh penyelenggara atau admin Eventara.</div>}
              <h2>{selected.title}</h2>
              <p className="modal-meta">
                <CalendarDays size={16} />
                {selected.date}
              </p>
              <p className="modal-meta">
                <MapPin size={16} />
                {selected.location}
              </p>
              {selected.startTime && (
                <p className="modal-meta"><Clock3 size={16} />{selected.startTime}{selected.endTime ? ' – ' + selected.endTime : ''}</p>
              )}
              {selected.format && <p className="modal-meta"><CalendarDays size={16} />Format: {selected.format}</p>}
              {selected.mapLink && (
                <a className="modal-map-link" href={selected.mapLink} target="_blank" rel="noopener noreferrer"><MapPin size={16} />Lihat lokasi di Google Maps<ArrowRight size={15} /></a>
              )}
              {selected.address && <p className="modal-detail-line"><b>Alamat lengkap</b>{selected.address}</p>}
              <div className="modal-section"><h3>Tentang acara</h3><p>{selected.description}</p></div>
              {selected.organizerName && <p className="modal-detail-line"><b>Penyelenggara</b>{selected.organizerName}</p>}
              <div className="modal-section">
                <h3>Tiket & pendaftaran</h3>
                <p>{selected.ticketType === 'Berbayar' ? 'Berbayar' : 'Gratis'}{selected.ticketPrice ? ' · ' + selected.ticketPrice : ''}</p>
                {selected.ticketLink && <a className="modal-map-link" href={selected.ticketLink} target="_blank" rel="noopener noreferrer">Beli / pesan tiket <ArrowRight size={15} /></a>}
                {selected.registrationInfo && <p>{selected.registrationInfo}</p>}
              </div>
              {selected.supportingLinks && selected.supportingLinks.length > 0 && (
                <div className="modal-section"><h3>Informasi lebih lanjut</h3>{selected.supportingLinks.map((link, index) => <a className="modal-support-link" key={link + index} href={link} target="_blank" rel="noopener noreferrer">Sumber informasi {index + 1}<ArrowRight size={14} /></a>)}</div>
              )}
              <div className="sample-warning">
                Data contoh prototipe. Verifikasi jadwal dan informasi melalui
                penyelenggara sebelum berkunjung.
              </div>
              <button
                className="modal-primary"
                onClick={() => setSelected(null)}
              >
                Kembali ke agenda
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
export default App;
