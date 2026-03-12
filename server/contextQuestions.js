/**
 * Context questions asked to the patient based on the type of exam.
 * Used to guide simplification and questions for the doctor.
 */
const QUESTIONS_BY_TYPE = {
  // Chest / Lung
  thoracique: [
    { id: "antecedents_tabac", label: "Do you smoke or have you smoked in the past?" },
    { id: "douleur_respiratoire", label: "Do you have chest pain or shortness of breath?" },
    { id: "objectif_comprendre", label: "What concerns you most about this report?" },
  ],
  // Brain / Head
  cerebral: [
    { id: "migraines", label: "Do you suffer from frequent headaches or migraines?" },
    { id: "troubles_neuro", label: "Have you noticed any balance or vision issues?" },
    { id: "objectif_comprendre", label: "What concerns you most about this report?" },
  ],
  // Knee / Joint
  genou: [
    { id: "traumatisme_recent", label: "Was there a recent injury or fall?" },
    { id: "difficulte_marche", label: "Do you have difficulty walking or a feeling of blockage?" },
    { id: "objectif_comprendre", label: "What concerns you most about this report?" },
  ],
  // General / Other
  default: [
    { id: "raison_examen", label: "What was the main reason for this exam?" },
    { id: "objectif_comprendre", label: "What concerns you most about this report?" },
  ],
};

/**
 * Returns a list of context questions for a given exam type.
 * @param {string} typeExamen - type_examen from report extraction (e.g. "chest CT")
 */
export function getContextQuestions(typeExamen = "") {
  const t = typeExamen.toLowerCase();
  if (t.includes("thorax") || t.includes("thoracique") || t.includes("lung") || t.includes("chest")) {
    return QUESTIONS_BY_TYPE.thoracique;
  }
  if (t.includes("cerveau") || t.includes("cerebral") || t.includes("brain") || t.includes("tête") || t.includes("head")) {
    return QUESTIONS_BY_TYPE.cerebral;
  }
  if (t.includes("genou") || t.includes("knee") || t.includes("articulation") || t.includes("joint")) {
    return QUESTIONS_BY_TYPE.genou;
  }
  return QUESTIONS_BY_TYPE.default;
}
