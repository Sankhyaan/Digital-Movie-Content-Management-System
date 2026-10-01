// @ts-nocheck — Legacy mock data, no longer used in production
// =============================================================================
// MOCK DATA — Hardcoded Movie Dataset
// =============================================================================
// This file contains the mock data used during development. When you attach
// your own database, this file becomes UNUSED. The MockMovieRepository reads
// from here, but your real repository will read from your DB instead.
// =============================================================================

import { Movie } from '../models/interfaces';

export const mockMovies: Movie[] = [
  // ─────────────────────────────────────────────────────────────────────────
  // 1. INTERSTELLAR
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-001',
    title: 'Interstellar',
    tagline: 'Mankind was born on Earth. It was never meant to die here.',
    synopsis:
      'In a future where Earth is becoming uninhabitable, a team of astronauts travels through a wormhole near Saturn in search of a new home for humanity. Cooper, a former NASA pilot turned farmer, must leave his children behind to lead the most important mission in human history. As the team explores strange new worlds, they confront the crushing effects of relativity, where hours on one planet equal years back on Earth.',
    releaseDate: '2014-11-07',
    rating: 8.7,
    runtime: 169,
    genres: ['Sci-Fi', 'Drama', 'Adventure'],
    language: 'English',
    posterUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=zSWdZVtXT7E',
    budget: '$165 million',
    boxOffice: '$677.5 million',
    productionCompanies: ['Paramount Pictures', 'Warner Bros.', 'Legendary Entertainment', 'Syncopy'],
    filmingLocations: ['Alberta, Canada', 'Iceland', 'Los Angeles, California'],
    trivia: [
      'Christopher Nolan planted 500 acres of corn for the film and sold it after filming, making a profit.',
      'The visual effects team created a simulation of a black hole using real physics equations.',
      'Matthew McConaughey\'s reaction to watching his children\'s video messages was done in one take.',
      'Kip Thorne, a Nobel Prize-winning physicist, served as scientific consultant and executive producer.'
    ],
    cast: [
      { id: 'cast-001', name: 'Matthew McConaughey', character: 'Joseph Cooper', photoUrl: 'https://image.tmdb.org/t/p/w185/wJiGedOCZhwMx9DezY8uwbNxmAY.jpg' },
      { id: 'cast-002', name: 'Anne Hathaway', character: 'Dr. Amelia Brand', photoUrl: 'https://image.tmdb.org/t/p/w185/s6tflSD53eDLxAOuhKmSJKIDidV.jpg' },
      { id: 'cast-003', name: 'Jessica Chastain', character: 'Murphy Cooper', photoUrl: 'https://image.tmdb.org/t/p/w185/lnBC6mEPMfHqSHbCwGmqxksOg9V.jpg' },
      { id: 'cast-004', name: 'Michael Caine', character: 'Professor Brand', photoUrl: 'https://image.tmdb.org/t/p/w185/bY3jfav1lFOBm1GPmMkR87ksFBM.jpg' }
    ],
    crew: [
      { id: 'crew-001', name: 'Christopher Nolan', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg' },
      { id: 'crew-002', name: 'Hans Zimmer', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/tpQnDeHY15szIXvpnhlprufz4d.jpg' },
      { id: 'crew-003', name: 'Hoyte van Hoytema', role: 'Cinematography', photoUrl: 'https://image.tmdb.org/t/p/w185/jbGMjMxjMbu2bYKmcFP1Y1GK16h.jpg' }
    ],
    isFeatured: true,
    isTrending: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 2. THE DARK KNIGHT
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-002',
    title: 'The Dark Knight',
    tagline: 'Why so serious?',
    synopsis:
      'When the menace known as The Joker emerges from his mysterious past, he wreaks havoc and chaos on the people of Gotham. The Dark Knight must accept one of the greatest psychological and physical tests of his ability to fight injustice, as Batman and Lieutenant James Gordon work with District Attorney Harvey Dent to dismantle the remaining criminal organizations.',
    releaseDate: '2008-07-18',
    rating: 9.0,
    runtime: 152,
    genres: ['Action', 'Crime', 'Drama'],
    language: 'English',
    posterUrl: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911BTUgMe1nS1xA.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/nMKdUUepR0i5zn0y1T4CsSB5ez.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=EXeTwQWrcwY',
    budget: '$185 million',
    boxOffice: '$1.005 billion',
    productionCompanies: ['Warner Bros.', 'Legendary Entertainment', 'Syncopy', 'DC Comics'],
    filmingLocations: ['Chicago, Illinois', 'London, England', 'Hong Kong'],
    trivia: [
      'Heath Ledger locked himself in a hotel room for six weeks to develop the Joker character.',
      'The film was the first to earn $1 billion worldwide with a non-sequel, non-franchise character.',
      'The truck-flip scene was done practically with no CGI.',
      'Heath Ledger passed away before the film\'s release and won a posthumous Academy Award for Best Supporting Actor.'
    ],
    cast: [
      { id: 'cast-005', name: 'Christian Bale', character: 'Bruce Wayne / Batman', photoUrl: 'https://image.tmdb.org/t/p/w185/qCpZn2e3dimwbryLnqxZuI88PTi.jpg' },
      { id: 'cast-006', name: 'Heath Ledger', character: 'The Joker', photoUrl: 'https://image.tmdb.org/t/p/w185/5Y9HnYYa0jF0fTkYKPoibNjiruq.jpg' },
      { id: 'cast-007', name: 'Aaron Eckhart', character: 'Harvey Dent / Two-Face', photoUrl: 'https://image.tmdb.org/t/p/w185/dPC3EkOlCkjY0iA2AGkZWbJmDfC.jpg' },
      { id: 'cast-008', name: 'Gary Oldman', character: 'Commissioner Gordon', photoUrl: 'https://image.tmdb.org/t/p/w185/2v9FVVBUrrkW2m3QOcYkuhq9A6o.jpg' }
    ],
    crew: [
      { id: 'crew-001', name: 'Christopher Nolan', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg' },
      { id: 'crew-002', name: 'Hans Zimmer', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/tpQnDeHY15szIXvpnhlprufz4d.jpg' },
      { id: 'crew-004', name: 'Jonathan Nolan', role: 'Screenplay', photoUrl: 'https://image.tmdb.org/t/p/w185/a1MxbVri3HkfSmGPbASJcMKFOVk.jpg' }
    ],
    isFeatured: true,
    isTrending: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 3. INCEPTION
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-003',
    title: 'Inception',
    tagline: 'Your mind is the scene of the crime.',
    synopsis:
      'Dom Cobb is a skilled thief, the absolute best in the dangerous art of extraction: stealing valuable secrets from deep within the subconscious during the dream state. His rare ability has made him a coveted player in the treacherous new world of corporate espionage, but it has also made him an international fugitive. Now Cobb is offered a chance at redemption through one last job: inception, planting an idea in someone\'s mind rather than stealing one.',
    releaseDate: '2010-07-16',
    rating: 8.8,
    runtime: 148,
    genres: ['Sci-Fi', 'Action', 'Thriller'],
    language: 'English',
    posterUrl: 'https://image.tmdb.org/t/p/w500/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
    budget: '$160 million',
    boxOffice: '$836.8 million',
    productionCompanies: ['Warner Bros.', 'Legendary Entertainment', 'Syncopy'],
    filmingLocations: ['Paris, France', 'Tokyo, Japan', 'Los Angeles, California', 'Tangier, Morocco', 'Alberta, Canada'],
    trivia: [
      'Christopher Nolan spent 10 years writing the screenplay.',
      'The zero-gravity hallway fight was filmed in a rotating corridor set.',
      'The famous spinning top at the end wobbles slightly, but Nolan has never confirmed if it falls.',
      'Leonardo DiCaprio initially thought the script was too complicated and almost turned it down.'
    ],
    cast: [
      { id: 'cast-009', name: 'Leonardo DiCaprio', character: 'Dom Cobb', photoUrl: 'https://image.tmdb.org/t/p/w185/wo2hJpn04vbtmh0B9utCFa3qlg.jpg' },
      { id: 'cast-010', name: 'Joseph Gordon-Levitt', character: 'Arthur', photoUrl: 'https://image.tmdb.org/t/p/w185/z2FA8js799xqtfiFjBVTVhXkTSA.jpg' },
      { id: 'cast-011', name: 'Elliot Page', character: 'Ariadne', photoUrl: 'https://image.tmdb.org/t/p/w185/cKqMSPJDkMW2MdGrGpmBemqqv9F.jpg' },
      { id: 'cast-012', name: 'Tom Hardy', character: 'Eames', photoUrl: 'https://image.tmdb.org/t/p/w185/d81K0RH8UX7tZj49tZaQhZ9ewH.jpg' }
    ],
    crew: [
      { id: 'crew-001', name: 'Christopher Nolan', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/xuAIuYSmsUzKlUMBFGVZaWsY3DZ.jpg' },
      { id: 'crew-002', name: 'Hans Zimmer', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/tpQnDeHY15szIXvpnhlprufz4d.jpg' },
      { id: 'crew-005', name: 'Wally Pfister', role: 'Cinematography', photoUrl: 'https://image.tmdb.org/t/p/w185/xCJMUb4IifNzGJFpHJmQvPfEAMd.jpg' }
    ],
    isFeatured: false,
    isTrending: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 4. THE SHAWSHANK REDEMPTION
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-004',
    title: 'The Shawshank Redemption',
    tagline: 'Fear can hold you prisoner. Hope can set you free.',
    synopsis:
      'Andy Dufresne, a young and successful banker, is sentenced to two consecutive life terms in prison for the murders of his wife and her lover — crimes he did not commit. Over the following two decades in the harsh Shawshank State Penitentiary, Andy befriends fellow prisoner Ellis "Red" Redding and finds a way to live life and bring hope in the bleakest of places.',
    releaseDate: '1994-09-23',
    rating: 9.3,
    runtime: 142,
    genres: ['Drama'],
    language: 'English',
    posterUrl: 'https://image.tmdb.org/t/p/w500/9cjIGRQL0PdRW1yJ6cOv0bGUvXY.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/kXfqcdQKsToO0OUXHcrrNCHDBzO.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=6hB3S9bIaco',
    budget: '$25 million',
    boxOffice: '$58.3 million',
    productionCompanies: ['Castle Rock Entertainment', 'Columbia Pictures'],
    filmingLocations: ['Mansfield, Ohio', 'St. Croix, U.S. Virgin Islands'],
    trivia: [
      'The film was a box office disappointment but became the most rented film of 1995.',
      'It has been #1 on IMDb\'s Top 250 list for most of its history.',
      'Morgan Freeman narrated the entire film in just a few recording sessions.',
      'The maggot Andy finds in his food was a real, live maggot — and the actors ate it.'
    ],
    cast: [
      { id: 'cast-013', name: 'Tim Robbins', character: 'Andy Dufresne', photoUrl: 'https://image.tmdb.org/t/p/w185/djLVFETFTvPyVUdrd7aLVykobof.jpg' },
      { id: 'cast-014', name: 'Morgan Freeman', character: 'Ellis "Red" Redding', photoUrl: 'https://image.tmdb.org/t/p/w185/oIciQWr8VwKoR8TmAw1owaiZFyb.jpg' },
      { id: 'cast-015', name: 'Bob Gunton', character: 'Warden Norton', photoUrl: 'https://image.tmdb.org/t/p/w185/ulKorgFzGs4BaEzExHGhjHjKyBi.jpg' }
    ],
    crew: [
      { id: 'crew-006', name: 'Frank Darabont', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/7LqmE3p1XTwCdNCOmBxovq210Qo.jpg' },
      { id: 'crew-007', name: 'Thomas Newman', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/cYJGxtKCr6h5CiN3nBpKmV2BIWJ.jpg' }
    ],
    isFeatured: false,
    isTrending: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 5. PARASITE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-005',
    title: 'Parasite',
    tagline: 'Act like you own the place.',
    synopsis:
      'Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan. All Korean, the Kim family — father Ki-taek, mother Chung-sook, son Ki-woo, and daughter Ki-jung — are unemployed, living in a semi-basement apartment. When Ki-woo gets a job tutoring for the Parks, the Kims see an opportunity to infiltrate the household one by one.',
    releaseDate: '2019-05-30',
    rating: 8.5,
    runtime: 132,
    genres: ['Thriller', 'Drama', 'Comedy'],
    language: 'Korean',
    posterUrl: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/TU9Lpz2lRbLPzUwG8lSwMqwCEMI.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=5xH0HfJHsaY',
    budget: '$11.4 million',
    boxOffice: '$263.1 million',
    productionCompanies: ['Barunson E&A', 'CJ Entertainment'],
    filmingLocations: ['Seoul, South Korea', 'Jeonju, South Korea'],
    trivia: [
      'It was the first non-English language film to win the Academy Award for Best Picture.',
      'The Parks\' house was built entirely on a studio set — no real house was used.',
      'Bong Joon-ho wrote the script with only Song Kang-ho in mind for Ki-taek.',
      'The flooding semi-basement scene was filmed in a massive water tank.'
    ],
    cast: [
      { id: 'cast-016', name: 'Song Kang-ho', character: 'Kim Ki-taek', photoUrl: 'https://image.tmdb.org/t/p/w185/fJT0Gp0PqpBVYiqPcTe2rHJYnVc.jpg' },
      { id: 'cast-017', name: 'Lee Sun-kyun', character: 'Park Dong-ik', photoUrl: 'https://image.tmdb.org/t/p/w185/vPBqdiYjWj7QR7ABT4ZGS9cK2L0.jpg' },
      { id: 'cast-018', name: 'Cho Yeo-jeong', character: 'Choi Yeon-gyo', photoUrl: 'https://image.tmdb.org/t/p/w185/sAfoSsj8I7ueJjxk8Wx0h3VDlCg.jpg' },
      { id: 'cast-019', name: 'Choi Woo-shik', character: 'Kim Ki-woo', photoUrl: 'https://image.tmdb.org/t/p/w185/nqbOUxRNlqxn6vSGfxrTEnzFHVR.jpg' }
    ],
    crew: [
      { id: 'crew-008', name: 'Bong Joon-ho', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/t6RocT0ymlDWKuENMJvJjzRkjzN.jpg' },
      { id: 'crew-009', name: 'Jung Jae-il', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/3epcJCwj1Y7jHC5JwYGHl0DcMwv.jpg' }
    ],
    isFeatured: true,
    isTrending: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 6. SPIDER-MAN: INTO THE SPIDER-VERSE
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-006',
    title: 'Spider-Man: Into the Spider-Verse',
    tagline: 'More than one wears the mask.',
    synopsis:
      'Teenager Miles Morales is bitten by a radioactive spider and gains superpowers similar to those of Spider-Man. When Wilson Fisk uses a super collider to open portals to other dimensions, Spider-People from various realities are pulled into Miles\'s world. Together, they must stop Fisk\'s plan before it destroys their realities.',
    releaseDate: '2018-12-14',
    rating: 8.4,
    runtime: 117,
    genres: ['Animation', 'Action', 'Adventure'],
    language: 'English',
    posterUrl: 'https://image.tmdb.org/t/p/w500/iiZZdoQBEYBv6id8su7ImL0oCbD.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/aUVCJ0HkcJIBMy0LjpsJkVLzMok.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=g4Hbz2jLxvQ',
    budget: '$90 million',
    boxOffice: '$375.5 million',
    productionCompanies: ['Columbia Pictures', 'Sony Pictures Animation', 'Marvel Entertainment'],
    filmingLocations: ['Culver City, California (Studio)'],
    trivia: [
      'The film renders at 12 frames per second (instead of 24) to mimic the look of comic book animation.',
      'It won the Academy Award for Best Animated Feature Film.',
      'Over 140 animators worked on the film, the largest crew for a Sony Animation feature.',
      'Each character from a different dimension has a unique animation style.'
    ],
    cast: [
      { id: 'cast-020', name: 'Shameik Moore', character: 'Miles Morales / Spider-Man', photoUrl: 'https://image.tmdb.org/t/p/w185/uJNaSTsfBOvtFWsPP0KikwcHZmX.jpg' },
      { id: 'cast-021', name: 'Jake Johnson', character: 'Peter B. Parker / Spider-Man', photoUrl: 'https://image.tmdb.org/t/p/w185/nqZJMVLeoaogU5sPa7MRH7K49TA.jpg' },
      { id: 'cast-022', name: 'Hailee Steinfeld', character: 'Gwen Stacy / Spider-Woman', photoUrl: 'https://image.tmdb.org/t/p/w185/dxSDWkiVaC6JYjrV3GXQT58GkLl.jpg' }
    ],
    crew: [
      { id: 'crew-010', name: 'Bob Persichetti', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/tGrPluy56sCIhPBk1DfAjv9wJIs.jpg' },
      { id: 'crew-011', name: 'Daniel Pemberton', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/1hFR6WBbIFKTHzxK3B8W9LDhMGn.jpg' }
    ],
    isFeatured: false,
    isTrending: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 7. SPIRITED AWAY
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-007',
    title: 'Spirited Away',
    tagline: 'The tunnel led Chihiro to a mysterious town...',
    synopsis:
      'During her family\'s move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and where humans are changed into beasts. When her parents are transformed into giant pigs by the witch Yubaba, Chihiro must work in Yubaba\'s bathhouse to find a way to free herself and her parents and return to the human world.',
    releaseDate: '2001-07-20',
    rating: 8.6,
    runtime: 125,
    genres: ['Animation', 'Fantasy', 'Adventure'],
    language: 'Japanese',
    posterUrl: 'https://image.tmdb.org/t/p/w500/39wmItIWsg5sZMyRUHLkWBcuVCM.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/bSvUW4mOB5uyaJjzMEvGmlCFqBP.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=ByXuk9QqQkk',
    budget: '$19 million',
    boxOffice: '$395.8 million',
    productionCompanies: ['Studio Ghibli', 'Tokuma Shoten', 'Nippon Television Network'],
    filmingLocations: ['Studio Ghibli, Koganei, Tokyo, Japan'],
    trivia: [
      'It is the highest-grossing film in Japanese history, holding the record for nearly 20 years.',
      'Hayao Miyazaki personally drew or corrected many of the film\'s 112,367 frames.',
      'It won the Academy Award for Best Animated Feature in 2003.',
      'The bathhouse was inspired by a real bathhouse in Jiufen, Taiwan.'
    ],
    cast: [
      { id: 'cast-023', name: 'Rumi Hiiragi', character: 'Chihiro / Sen', photoUrl: 'https://image.tmdb.org/t/p/w185/zITaVOqEwOh5dKxL6RbSWJfB4EX.jpg' },
      { id: 'cast-024', name: 'Miyu Irino', character: 'Haku', photoUrl: 'https://image.tmdb.org/t/p/w185/jS3ygS4nvPHikHEhp81UYhXKfkp.jpg' },
      { id: 'cast-025', name: 'Mari Natsuki', character: 'Yubaba / Zeniba', photoUrl: 'https://image.tmdb.org/t/p/w185/8EJYb7IdqGFmr5bZ5DdKvGNH3PS.jpg' }
    ],
    crew: [
      { id: 'crew-012', name: 'Hayao Miyazaki', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/mG3cfxtA5jvDYEXWLjMgNjPLsNL.jpg' },
      { id: 'crew-013', name: 'Joe Hisaishi', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/4CbbPY5bVPsnIOaaZiAmnOvnbiE.jpg' }
    ],
    isFeatured: true,
    isTrending: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 8. FIGHT CLUB
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-008',
    title: 'Fight Club',
    tagline: 'Mischief. Mayhem. Soap.',
    synopsis:
      'An insomniac office worker and a devil-may-care soap maker form an underground fight club that evolves into much more. The unnamed narrator, depressed with his white-collar job, forms a "fight club" with soap salesman Tyler Durden, and becomes embroiled in a relationship triangle with a destitute woman named Marla Singer. What follows is a descent into anarchist chaos.',
    releaseDate: '1999-10-15',
    rating: 8.8,
    runtime: 139,
    genres: ['Drama', 'Thriller'],
    language: 'English',
    posterUrl: 'https://image.tmdb.org/t/p/w500/pB8BM7pdSp6B6Ih7QZ4DrQ3PmJK.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/hZkgoQYus5dXo3H8T7CYV25UmIj.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=SUXWAEX2jlg',
    budget: '$63 million',
    boxOffice: '$101.2 million',
    productionCompanies: ['Fox 2000 Pictures', 'Regency Enterprises', 'Linson Films'],
    filmingLocations: ['Los Angeles, California', 'Wilmington, Delaware'],
    trivia: [
      'Brad Pitt and Edward Norton actually learned to make soap for the film.',
      'David Fincher shot over 1,500 rolls of film during production.',
      'The film flopped at the box office but became a massive cult classic on DVD.',
      'There is a Starbucks cup visible in every scene — this was done intentionally by Fincher.'
    ],
    cast: [
      { id: 'cast-026', name: 'Brad Pitt', character: 'Tyler Durden', photoUrl: 'https://image.tmdb.org/t/p/w185/oTB9vGIBacH5aQNS0pUM74QSMOx.jpg' },
      { id: 'cast-027', name: 'Edward Norton', character: 'The Narrator', photoUrl: 'https://image.tmdb.org/t/p/w185/5XBzD5WuTyVQZeS4MNcjjZ9bp0t.jpg' },
      { id: 'cast-028', name: 'Helena Bonham Carter', character: 'Marla Singer', photoUrl: 'https://image.tmdb.org/t/p/w185/DDeITcCpnRCimahRCWtXvGckmkZ.jpg' }
    ],
    crew: [
      { id: 'crew-014', name: 'David Fincher', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/dcBHejOsKvzVZVozWJAPQgZ5KIh.jpg' },
      { id: 'crew-015', name: 'The Dust Brothers', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/bYjf2aAMdwZSSkqrDEiJpGpVJPR.jpg' }
    ],
    isFeatured: false,
    isTrending: false
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 9. THE MATRIX
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-009',
    title: 'The Matrix',
    tagline: 'Welcome to the Real World.',
    synopsis:
      'Set in the 22nd century, The Matrix tells the story of a computer hacker who joins a group of underground insurgents fighting the vast and powerful computers who now rule the earth. When Neo is contacted by Morpheus, a legendary hacker, he discovers the shocking truth: the life he knows is an elaborate deception spun by AI overlords. Neo must decide whether to join the resistance and fight for humanity\'s future.',
    releaseDate: '1999-03-31',
    rating: 8.7,
    runtime: 136,
    genres: ['Sci-Fi', 'Action'],
    language: 'English',
    posterUrl: 'https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/fNG7i7RqMErkcqhohV2a6cV1Ehy.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=vKQi3bBA1y8',
    budget: '$63 million',
    boxOffice: '$466.6 million',
    productionCompanies: ['Warner Bros.', 'Village Roadshow Pictures', 'Groucho II Film Partnership'],
    filmingLocations: ['Sydney, Australia', 'Alameda, California'],
    trivia: [
      'Keanu Reeves trained for four months in martial arts before filming began.',
      'The iconic "bullet time" effect required 120 still cameras firing in sequence.',
      'Will Smith was originally offered the role of Neo but turned it down.',
      'The green-tinted code raining down the screen is actually sushi recipes.'
    ],
    cast: [
      { id: 'cast-029', name: 'Keanu Reeves', character: 'Thomas Anderson / Neo', photoUrl: 'https://image.tmdb.org/t/p/w185/4D0PpNI0hmqTnhA3MHqUYcSl8zy.jpg' },
      { id: 'cast-030', name: 'Laurence Fishburne', character: 'Morpheus', photoUrl: 'https://image.tmdb.org/t/p/w185/8suOhUmPFCKZDyed7UNaIyhX1s7.jpg' },
      { id: 'cast-031', name: 'Carrie-Anne Moss', character: 'Trinity', photoUrl: 'https://image.tmdb.org/t/p/w185/xD4jEjEBLjj3yVOAvl9eMTqEjJ8.jpg' },
      { id: 'cast-032', name: 'Hugo Weaving', character: 'Agent Smith', photoUrl: 'https://image.tmdb.org/t/p/w185/nDVj3MeeXdirqlJHIxOd3bFyZn3.jpg' }
    ],
    crew: [
      { id: 'crew-016', name: 'Lana Wachowski', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/7WLHP5W1XRJNqlnkqBmtGwUj3uy.jpg' },
      { id: 'crew-017', name: 'Don Davis', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/aBwM4X5DqsD03GoP5uaRNRkNaGI.jpg' }
    ],
    isFeatured: false,
    isTrending: true
  },

  // ─────────────────────────────────────────────────────────────────────────
  // 10. THE GRAND BUDAPEST HOTEL
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'movie-010',
    title: 'The Grand Budapest Hotel',
    tagline: 'A perfect holiday without leaving home.',
    synopsis:
      'The adventures of Gustave H, a legendary concierge at a famous European hotel between the wars, and Zero Moustafa, the lobby boy who becomes his most trusted friend. The story involves the theft and recovery of a priceless Renaissance painting, and a battle for an enormous family fortune — all against the backdrop of a suddenly changing continent.',
    releaseDate: '2014-03-28',
    rating: 8.1,
    runtime: 99,
    genres: ['Comedy', 'Drama', 'Adventure'],
    language: 'English',
    posterUrl: 'https://image.tmdb.org/t/p/w500/eWdyYQreja6JGCzqHWT0RYieOlE.jpg',
    backdropUrl: 'https://image.tmdb.org/t/p/original/nX5XotM9yprCKarRH4fzOq1VM1J.jpg',
    trailerUrl: 'https://www.youtube.com/watch?v=1Fg5iWmKBoE',
    budget: '$25 million',
    boxOffice: '$174.8 million',
    productionCompanies: ['Fox Searchlight Pictures', 'Indian Paintbrush', 'Studio Babelsberg'],
    filmingLocations: ['Görlitz, Germany', 'Dresden, Germany'],
    trivia: [
      'Wes Anderson used three different aspect ratios to represent three different time periods.',
      'The hotel exterior was a miniature model, not a real building.',
      'Ralph Fiennes performed many of his own stunts, including the ski chase.',
      'It won four Academy Awards, the most of any film that year.'
    ],
    cast: [
      { id: 'cast-033', name: 'Ralph Fiennes', character: 'M. Gustave H.', photoUrl: 'https://image.tmdb.org/t/p/w185/tJr9GcmGNHhLVyBGLFBklfsM3M3.jpg' },
      { id: 'cast-034', name: 'Tony Revolori', character: 'Zero Moustafa', photoUrl: 'https://image.tmdb.org/t/p/w185/8FhID6HK8bpbE8GRGFbIjUCEhXA.jpg' },
      { id: 'cast-035', name: 'Saoirse Ronan', character: 'Agatha', photoUrl: 'https://image.tmdb.org/t/p/w185/oMAIax0l2MSOaap2Wk8Ccqj7m5d.jpg' },
      { id: 'cast-036', name: 'Adrien Brody', character: 'Dmitri Desgoffe-und-Taxis', photoUrl: 'https://image.tmdb.org/t/p/w185/lJK2pNGhcx0InnDDnpdlj9qKIjF.jpg' }
    ],
    crew: [
      { id: 'crew-018', name: 'Wes Anderson', role: 'Director', photoUrl: 'https://image.tmdb.org/t/p/w185/wUaqJjr1r9VzXHj6Ua91PZ5eRzD.jpg' },
      { id: 'crew-019', name: 'Alexandre Desplat', role: 'Composer', photoUrl: 'https://image.tmdb.org/t/p/w185/GQeEFd3CPL7niVBrb0VdI7DdBTi.jpg' }
    ],
    isFeatured: false,
    isTrending: false
  }
];
