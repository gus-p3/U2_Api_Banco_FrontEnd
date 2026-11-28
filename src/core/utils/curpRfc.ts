/**
 * Cálculo del prefijo base determinista de CURP (primeros 13 caracteres: 4 letras + AAMMDD + sexo + estado)
 * y RFC Persona Física (primeros 10 caracteres: 4 letras + AAMMDD) a partir de los datos personales.
 * Los caracteres finales (consonantes/homoclave/dígito verificador) los completa el usuario libremente.
 */

export const INEGI_TO_CURP_STATE: Record<string, string> = {
  '01': 'AS', // Aguascalientes
  '02': 'BC', // Baja California
  '03': 'BS', // Baja California Sur
  '04': 'CC', // Campeche
  '05': 'CL', // Coahuila
  '06': 'CM', // Colima
  '07': 'CS', // Chiapas
  '08': 'CH', // Chihuahua
  '09': 'DF', // Ciudad de México
  '10': 'DG', // Durango
  '11': 'GT', // Guanajuato
  '12': 'GR', // Guerrero
  '13': 'HG', // Hidalgo
  '14': 'JC', // Jalisco
  '15': 'MC', // México
  '16': 'MN', // Michoacán
  '17': 'MS', // Morelos
  '18': 'NT', // Nayarit
  '19': 'NL', // Nuevo León
  '20': 'OC', // Oaxaca
  '21': 'PL', // Puebla
  '22': 'QT', // Querétaro
  '23': 'QR', // Quintana Roo
  '24': 'SP', // San Luis Potosí
  '25': 'SL', // Sinaloa
  '26': 'SR', // Sonora
  '27': 'TC', // Tabasco
  '28': 'TS', // Tamaulipas
  '29': 'TL', // Tlaxcala
  '30': 'VZ', // Veracruz
  '31': 'YN', // Yucatán
  '32': 'ZS', // Zacatecas
  NE: 'NE', // Nacido en el extranjero
};

const PARTICLES = new Set([
  'DA',
  'DAS',
  'DE',
  'DEL',
  'DER',
  'DI',
  'DIE',
  'DD',
  'EL',
  'LA',
  'LOS',
  'LAS',
  'LE',
  'LES',
  'MAC',
  'MC',
  'VAN',
  'VON',
  'Y',
]);

const IGNORED_FIRST_NAMES = new Set(['MARIA', 'MA', 'MA.', 'M', 'M.', 'JOSE', 'J', 'J.']);

const INCONVENIENT_WORDS = new Set([
  'BACA',
  'BAKA',
  'BUEI',
  'BUEY',
  'CACA',
  'CACO',
  'CAGA',
  'CAGO',
  'CAKA',
  'CAKO',
  'COGE',
  'COGI',
  'COJA',
  'COJE',
  'COJI',
  'COJO',
  'COLA',
  'CULO',
  'FALO',
  'FETO',
  'GETA',
  'GUEI',
  'GUEY',
  'JETA',
  'JOTO',
  'KACA',
  'KACO',
  'KAGA',
  'KAGO',
  'KAKA',
  'KAKO',
  'KOGE',
  'KOGI',
  'KOJA',
  'KOJE',
  'KOJI',
  'KOJO',
  'KOLA',
  'KULO',
  'LILO',
  'LOCA',
  'LOCO',
  'LOKA',
  'LOKO',
  'MAME',
  'MAMO',
  'MEAR',
  'MEAS',
  'MEON',
  'MIAR',
  'MION',
  'MOCO',
  'MOKO',
  'MULA',
  'MULO',
  'NACA',
  'NACO',
  'PEDA',
  'PEDO',
  'PENE',
  'PIPI',
  'PITO',
  'POPO',
  'PUTA',
  'PUTO',
  'QULO',
  'RATA',
  'ROBA',
  'ROBE',
  'ROBO',
  'RUIN',
  'SENO',
  'TETA',
  'VACA',
  'VAGA',
  'VAGO',
  'VAKA',
  'VUEI',
  'VUEY',
  'WUEI',
  'WUEY',
]);

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

function stripAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function normalizeForCurp(raw: string): string {
  const withPlaceholder = raw.trim().toUpperCase().replace(/Ñ/g, '#');
  return stripAccents(withPlaceholder)
    .replace(/#/g, 'X')
    .replace(/[^A-Z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeForRfc(raw: string): string {
  const withPlaceholder = raw.trim().toUpperCase().replace(/Ñ/g, '#');
  return stripAccents(withPlaceholder)
    .replace(/#/g, 'Ñ')
    .replace(/[^A-ZÑ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSignificantTokens(normalized: string): string[] {
  const words = normalized.split(' ').filter(Boolean);
  const filtered = words.filter((w) => !PARTICLES.has(w));
  return filtered.length > 0 ? filtered : words;
}

function pickEffectiveName(firstName: string, secondName: string | undefined, forCurp: boolean): string {
  const combined = [firstName, secondName].filter(Boolean).join(' ');
  const norm = forCurp ? normalizeForCurp(combined) : normalizeForRfc(combined);
  const tokens = cleanSignificantTokens(norm);
  if (tokens.length === 0) return '';
  if (tokens.length > 1 && IGNORED_FIRST_NAMES.has(tokens[0]!)) {
    return tokens[1]!;
  }
  return tokens[0]!;
}

function pickSurname(raw: string | undefined, forCurp: boolean): string {
  if (!raw || !raw.trim()) return '';
  const norm = forCurp ? normalizeForCurp(raw) : normalizeForRfc(raw);
  const tokens = cleanSignificantTokens(norm);
  return tokens[0] ?? '';
}

function firstInternalVowel(word: string): string {
  for (let i = 1; i < word.length; i += 1) {
    const ch = word[i]!;
    if (VOWELS.has(ch)) return ch;
  }
  return 'X';
}

function firstInternalConsonant(word: string): string {
  if (!word) return 'X';
  for (let i = 1; i < word.length; i += 1) {
    const ch = word[i]!;
    if (!VOWELS.has(ch) && /[A-Z]/.test(ch)) {
      return ch;
    }
  }
  return 'X';
}

function sanitizeInconvenient(prefix4: string): string {
  if (INCONVENIENT_WORDS.has(prefix4)) {
    return `${prefix4[0]}X${prefix4.slice(2)}`;
  }
  return prefix4;
}

export interface IdentityCalcInput {
  firstName: string;
  secondName?: string;
  lastName: string;
  secondLastName?: string;
  birthDate: string; // YYYY-MM-DD
  genderName?: string;
  birthStateCode?: string; // clave INEGI '01'..'32' o 'NE'
}

export function resolveGenderLetter(genderName?: string): 'H' | 'M' | null {
  if (!genderName) return null;
  const norm = stripAccents(genderName.trim());
  if (norm.startsWith('H') || norm.startsWith('MASC')) return 'H';
  if (norm.startsWith('M') || norm.startsWith('F')) return 'M';
  return null;
}

export function resolveCurpStateCode(inegiOrCurpCode?: string): string | null {
  if (!inegiOrCurpCode) return null;
  const clean = inegiOrCurpCode.trim().toUpperCase();
  if (INEGI_TO_CURP_STATE[clean]) return INEGI_TO_CURP_STATE[clean]!;
  if (/^[A-Z]{2}$/.test(clean) && Object.values(INEGI_TO_CURP_STATE).includes(clean)) {
    return clean;
  }
  return null;
}

/**
 * Calcula los primeros 16 caracteres deterministas de la CURP (ej. MEAB051016HGTNMR):
 * 4 letras iniciales + AAMMDD + sexo (H/M) + entidad federativa (2 letras) + 3 consonantes internas.
 * Solo los últimos 2 caracteres (homonimia + dígito verificador RENAPO) los completa el usuario.
 */
export function calculateCurp(input: IdentityCalcInput): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthDate.trim());
  if (!dateMatch) return null;

  const yy = dateMatch[1]!.slice(2);
  const mm = dateMatch[2]!;
  const dd = dateMatch[3]!;

  const sex = resolveGenderLetter(input.genderName);
  const stateCode = resolveCurpStateCode(input.birthStateCode);
  const pat = pickSurname(input.lastName, true);
  const mat = pickSurname(input.secondLastName, true);
  const nom = pickEffectiveName(input.firstName, input.secondName, true);

  if (!sex || !stateCode || !pat || !nom) return null;

  const l1 = pat[0] ?? 'X';
  const l2 = firstInternalVowel(pat);
  const l3 = mat ? (mat[0] ?? 'X') : 'X';
  const l4 = nom[0] ?? 'X';
  const prefix4 = sanitizeInconvenient(`${l1}${l2}${l3}${l4}`);

  const c1 = firstInternalConsonant(pat);
  const c2 = mat ? firstInternalConsonant(mat) : 'X';
  const c3 = firstInternalConsonant(nom);

  return `${prefix4}${yy}${mm}${dd}${sex}${stateCode}${c1}${c2}${c3}`;
}

/**
 * Calcula los primeros 10 caracteres del RFC Persona Física (ej. MEAB051016):
 * 4 letras iniciales + AAMMDD.
 * Los 3 caracteres finales de homoclave los ingresa el usuario.
 */
export function calculateRfc(input: IdentityCalcInput): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.birthDate.trim());
  if (!dateMatch) return null;

  const yy = dateMatch[1]!.slice(2);
  const mm = dateMatch[2]!;
  const dd = dateMatch[3]!;

  const pat = pickSurname(input.lastName, false);
  const mat = pickSurname(input.secondLastName, false);
  const nom = pickEffectiveName(input.firstName, input.secondName, false);

  if (!pat || !nom) return null;

  let rawPrefix: string;
  if (!mat) {
    rawPrefix = `${pat.slice(0, 2).padEnd(2, 'X')}${nom.slice(0, 2).padEnd(2, 'X')}`;
  } else if (pat.length <= 2) {
    rawPrefix = `${pat[0] ?? 'X'}${mat[0] ?? 'X'}${nom.slice(0, 2).padEnd(2, 'X')}`;
  } else {
    rawPrefix = `${pat[0] ?? 'X'}${firstInternalVowel(pat)}${mat[0] ?? 'X'}${nom[0] ?? 'X'}`;
  }

  const prefix4 = sanitizeInconvenient(rawPrefix.replace(/Ñ/g, 'X'));
  return `${prefix4}${yy}${mm}${dd}`;
}
