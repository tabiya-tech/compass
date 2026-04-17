// Personal data variations for the registration step. Each VU gets a
// deterministic combination so traffic is diverse but reproducible.
// Field keys match the backend's plain_personal_data schema — see
// `backend/app/user_profile/service.py:138-140`.

const FIRST_NAMES = [
  'Chanda', 'Mwamba', 'Bwalya', 'Mutale', 'Mulenga',
  'Thandiwe', 'Chilufya', 'Kapembwa', 'Nchimunya', 'Lubinda',
];

const LAST_NAMES = [
  'Banda', 'Phiri', 'Mwale', 'Tembo', 'Zulu',
  'Mumba', 'Ngoma', 'Lungu', 'Musonda', 'Mbewe',
];

const INSTITUTION_NAMES = [
  'University of Zambia',
  'Copperbelt University',
  'Mulungushi University',
  'Evelyn Hone College',
  'Lusaka Business and Technical College',
  'Northern Technical College',
  'Zambia Institute of Business Studies',
  'Kitwe College of Education',
];

const PROGRAMME_NAMES = [
  'Business Administration',
  'Information Technology',
  'Agricultural Sciences',
  'Nursing and Midwifery',
  'Mechanical Engineering',
  'Education',
  'Public Health',
  'Hospitality and Tourism',
];

const SCHOOL_YEARS = ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5', 'Year 6'];

// Deterministically pick one value from each array so that across VUs and
// iterations we get broad coverage. Each field uses a different offset so
// a single VU doesn't always get "matching" indices.
export function pickPersonalData(vu, iter) {
  return {
    first_name: FIRST_NAMES[(vu + iter) % FIRST_NAMES.length],
    last_name: LAST_NAMES[(vu + iter + 3) % LAST_NAMES.length],
    institution_name: INSTITUTION_NAMES[(vu + iter + 5) % INSTITUTION_NAMES.length],
    programme_name: PROGRAMME_NAMES[(vu + iter + 7) % PROGRAMME_NAMES.length],
    school_year: SCHOOL_YEARS[(vu + iter + 2) % SCHOOL_YEARS.length],
  };
}
