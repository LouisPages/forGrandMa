/**
 * Patient context questions adapted to exam type.
 * Used to guide simplification and questions for the doctor.
 */

/** @typedef {{ id: string, label: string }} ContextQuestion */

/** Generic questions (all exam types) */
const GENERIC = [
  { id: "autres_examens_recents", label: "Have you had other imaging exams recently?" },
  { id: "traitement_en_cours", label: "Do you take any medication regularly?" },
  { id: "objectif_comprendre", label: "What concerns you most about this report?" },
];

/** Questions for chest / lung */
const THORACIC = [
  { id: "antecedents_respiratoires", label: "Do you have any respiratory history (asthma, bronchitis, etc.)?" },
  { id: "tabac", label: "Are you or have you been a smoker?" },
  { id: "souffle", label: "Do you have breathing difficulties or treatment for shortness of breath?" },
];

/** Questions for abdomen */
const ABDOMINAL = [
  { id: "antecedents_digestifs", label: "Do you have any digestive or liver history?" },
  { id: "douleurs_ventre", label: "Do you have any abdominal pain or discomfort?" },
];

/** Questions for MRI / neurology / head */
const NEURO_MRI = [
  { id: "antecedents_neuro", label: "Do you have any neurological history (migraines, stroke, etc.)?" },
  { id: "cephalées", label: "Do you have frequent headaches?" },
];

/** Questions for ultrasound */
const ECHO = [
  { id: "grossesse", label: "Are you pregnant or could you be?" },
  { id: "organe_cible", label: "Did the exam focus on a specific organ (liver, kidney, thyroid, etc.)? Which one?" },
];

/**
 * Returns context questions to show for a given exam type.
 * @param {string} typeExamen - type_examen from report extraction (e.g. "chest CT", "scanner thoracique")
 * @returns {ContextQuestion[]}
 */
export function getContextQuestions(typeExamen) {
  if (!typeExamen || typeof typeExamen !== "string") {
    return [...GENERIC];
  }
  const t = typeExamen.toLowerCase();
  const questions = [...GENERIC];

  if (t.includes("thoracic") || t.includes("thorax") || t.includes("chest") || t.includes("lung") || t.includes("pulmonary") || t.includes("poumon") || t.includes("pulmonaire")) {
    questions.push(...THORACIC);
  } else if (t.includes("abdominal") || t.includes("abdomen") || t.includes("liver") || t.includes("foie") || t.includes("kidney") || t.includes("rein")) {
    questions.push(...ABDOMINAL);
  } else if (t.includes("mri") || t.includes("irm") || t.includes("cephal") || t.includes("head") || t.includes("crâne") || t.includes("neuro") || t.includes("brain")) {
    questions.push(...NEURO_MRI);
  } else if (t.includes("ultrasound") || t.includes("échographie") || t.includes("echo") || t.includes("sonography")) {
    questions.push(...ECHO);
  }

  return questions;
}
