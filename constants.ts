// Configuration for the Sequence
export const SEQUENCE_LENGTH = 50; // Must match your train_lstm.py SEQ_LEN
export const LANDMARK_COUNT = 21;
export const FEATURE_DIM = 63; // 21 landmarks * 3 coordinates (x,y,z)

// Backend URL - Use relative path for proxy (works on localhost, network, and ngrok)
export const API_URL = (import.meta as any).env?.VITE_API_URL || '/api/predict';
export const NSL_API_URL = (import.meta as any).env?.VITE_NSL_API_URL || '/api/predict_nsl';

export const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// NSL: 53 sign classes (romanized names matching model output order)
export const NSL_CLASSES = [
  "a", "aa", "ah", "ai", "am", "au", "ba", "bha", "cha", "chha",
  "da", "dda", "ddha", "dha", "dsha", "e", "ga", "gha", "gya", "ha",
  "i", "ii", "ja", "jha", "ka", "kha", "ksha", "la", "ma", "msha",
  "na", "nga", "nna", "nya", "o", "pa", "pha", "ra", "ri", "sa",
  "sha", "ssa", "ta", "tha", "tra", "tsha", "tta", "ttha", "u", "uu",
  "wa", "ya", "yan",
];

// Romanized → Devanagari display mapping
export const DEVANAGARI: Record<string, string> = {
  "ka": "क", "kha": "ख", "ga": "ग", "gha": "घ", "nga": "ङ",
  "cha": "च", "chha": "छ", "ja": "ज", "jha": "झ", "nya": "ञ",
  "ta": "ट", "tha": "ठ", "da": "ड", "dha": "ढ", "na": "ण",
  "tta": "त", "ttha": "थ", "dda": "द", "ddha": "ध", "nna": "न",
  "pa": "प", "pha": "फ", "ba": "ब", "bha": "भ", "ma": "म",
  "ya": "य", "ra": "र", "la": "ल", "wa": "व", "sha": "श",
  "ssa": "ष", "sa": "स", "ha": "ह", "ksha": "क्ष", "tra": "त्र",
  "gya": "ज्ञ", "a": "अ", "aa": "आ", "i": "इ", "ii": "ई",
  "u": "उ", "uu": "ऊ", "e": "ए", "o": "ओ", "ai": "ऐ",
  "au": "औ", "am": "अं", "ah": "अः", "ri": "ऋ", "dsha": "स",
  "msha": "ष", "tsha": "श", "yan": "ञ",
};

// Vowel sign names — used to detect consonant vs vowel for combining
export const VOWEL_SIGNS = new Set([
  "a", "aa", "i", "ii", "u", "uu", "e", "o", "ai", "au", "am", "ah", "ri",
]);

// Vowel matra forms (when a vowel follows a consonant, use this instead of standalone)
export const VOWEL_MATRAS: Record<string, string> = {
  "a": "",      // inherent vowel — no visible matra
  "aa": "ा",
  "i": "ि",
  "ii": "ी",
  "u": "ु",
  "uu": "ू",
  "ri": "ृ",
  "e": "े",
  "ai": "ै",
  "o": "ो",
  "au": "ौ",
  "am": "ं",
  "ah": "ः",
};

/**
 * Alias map: model may output either name for the same letter.
 * sa↔dsha (स), ssa↔msha (ष), sha↔tsha (श), nya↔yan (ञ)
 * normalizeSign() maps both to the canonical (first) form so comparisons work.
 */
const SIGN_ALIASES: Record<string, string> = {
  "dsha": "sa",  "sa": "sa",
  "msha": "ssa", "ssa": "ssa",
  "tsha": "sha", "sha": "sha",
  "yan": "nya",  "nya": "nya",
};

/** Normalize a sign name so aliases compare equal. */
export function normalizeSign(sign: string): string {
  return SIGN_ALIASES[sign] ?? sign;
}

/** Check if two sign names refer to the same letter (handles aliases). */
export function signsMatch(a: string, b: string): boolean {
  return normalizeSign(a) === normalizeSign(b);
}

/**
 * Combine a sequence of romanized sign names into proper Devanagari text.
 * Handles vowel matras: when a vowel follows a consonant, the matra form
 * is appended to the consonant instead of using the standalone vowel.
 */
export function combineDevanagari(signs: string[]): string {
  let result = "";
  let prevWasConsonant = false;

  for (const sign of signs) {
    if (VOWEL_SIGNS.has(sign)) {
      if (prevWasConsonant) {
        result += VOWEL_MATRAS[sign] ?? "";
      } else {
        result += DEVANAGARI[sign] ?? sign;
      }
      prevWasConsonant = false;
    } else {
      result += DEVANAGARI[sign] ?? sign;
      prevWasConsonant = true;
    }
  }
  return result;
}