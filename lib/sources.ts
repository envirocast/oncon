export interface Citation {
  id: string;
  title: string;
  publisher: string;
  url: string;
}

export const SOURCES: Citation[] = [
  { id: "nci-diagnosis", title: "How Cancer Is Diagnosed", publisher: "National Cancer Institute", url: "https://www.cancer.gov/about-cancer/diagnosis-staging/diagnosis" },
  { id: "988-lifeline", title: "988 Suicide & Crisis Lifeline", publisher: "Substance Abuse and Mental Health Services Administration", url: "https://988lifeline.org/" },
  { id: "nci-clinical-trials", title: "What Are Clinical Trials?", publisher: "National Cancer Institute", url: "https://www.cancer.gov/research/participate/clinical-trials/what-are-clinical-trials" },
  { id: "nci-cancer", title: "What Is Cancer?", publisher: "National Cancer Institute", url: "https://www.cancer.gov/about-cancer/understanding/what-is-cancer" },
  { id: "medline-anatomy", title: "Anatomy", publisher: "MedlinePlus, U.S. National Library of Medicine", url: "https://medlineplus.gov/anatomy.html" },
  { id: "nci-terms", title: "NCI Dictionary of Cancer Terms", publisher: "National Cancer Institute", url: "https://www.cancer.gov/publications/dictionaries/cancer-terms" },
  { id: "nci-communication", title: "Communication in Cancer Care: Patient Version", publisher: "National Cancer Institute", url: "https://www.cancer.gov/about-cancer/coping/adjusting-to-cancer/communication-pdq" },
  { id: "cdc-plain-language", title: "Plain Language Materials & Resources", publisher: "Centers for Disease Control and Prevention", url: "https://www.cdc.gov/health-literacy/php/develop-materials/plain-language.html" },
  { id: "radiology-biopsy", title: "General Biopsy", publisher: "RadiologyInfo.org (ACR/RSNA)", url: "https://www.radiologyinfo.org/en/info/biopgen" },
  { id: "radiology-ct", title: "Body CT", publisher: "RadiologyInfo.org (ACR/RSNA)", url: "https://www.radiologyinfo.org/en/info/bodyct" },
  { id: "radiology-mri", title: "Brain MRI", publisher: "RadiologyInfo.org (ACR/RSNA)", url: "https://www.radiologyinfo.org/en/info/mri-brain" },
  { id: "radiology-picc", title: "Pediatric PICC Line Placement", publisher: "RadiologyInfo.org (ACR/RSNA)", url: "https://www.radiologyinfo.org/en/info/picc" },
  { id: "radiology-ultrasound", title: "Abdominal Ultrasound", publisher: "RadiologyInfo.org (ACR/RSNA)", url: "https://www.radiologyinfo.org/en/info/abdominus" },
  { id: "radiology-pet", title: "PET/CT", publisher: "RadiologyInfo.org (ACR/RSNA)", url: "https://www.radiologyinfo.org/en/info/pet" },
  { id: "medline-xrays", title: "X-Rays", publisher: "MedlinePlus, U.S. National Library of Medicine", url: "https://medlineplus.gov/xrays.html" },
  { id: "radiology-ablation", title: "Thermal Ablation for Tumor Treatment", publisher: "RadiologyInfo.org (ACR/RSNA)", url: "https://www.radiologyinfo.org/en/info/thermal-ablation-therapy" },
  { id: "radiology-embolization", title: "Pediatric Bronchial Artery Embolization", publisher: "RadiologyInfo.org (ACR/RSNA)", url: "https://www.radiologyinfo.org/en/info/embolization" },
  { id: "medline-cbc", title: "Complete Blood Count (CBC)", publisher: "MedlinePlus, U.S. National Library of Medicine", url: "https://medlineplus.gov/lab-tests/complete-blood-count-cbc/" },
  { id: "medline-cvc", title: "Central Venous Catheter", publisher: "MedlinePlus, U.S. National Library of Medicine", url: "https://medlineplus.gov/ency/patientinstructions/000491.htm" },
  { id: "nci-chemotherapy", title: "Chemotherapy to Treat Cancer", publisher: "National Cancer Institute", url: "https://www.cancer.gov/about-cancer/treatment/types/chemotherapy" },
  { id: "nci-radiation", title: "Radiation Therapy to Treat Cancer", publisher: "National Cancer Institute", url: "https://www.cancer.gov/about-cancer/treatment/types/radiation-therapy" },
  { id: "nci-side-effects", title: "Side Effects of Cancer Treatment", publisher: "National Cancer Institute", url: "https://www.cancer.gov/about-cancer/treatment/side-effects" },
  { id: "nci-infection", title: "Infection and Neutropenia during Cancer Treatment", publisher: "National Cancer Institute", url: "https://www.cancer.gov/about-cancer/treatment/side-effects/infection" },
  { id: "nci-treatments", title: "Types of Cancer Treatment", publisher: "National Cancer Institute", url: "https://www.cancer.gov/about-cancer/treatment/types" },
];

export const TOPIC_SOURCE_IDS: Record<string, string[]> = {
  biopsy: ["nci-diagnosis", "radiology-biopsy"],
  ct: ["nci-diagnosis", "radiology-ct"],
  mri: ["nci-diagnosis", "radiology-mri"],
  ultrasound: ["radiology-ultrasound"],
  bloodtest: ["nci-diagnosis", "medline-cbc"],
  catheter: ["medline-cvc", "radiology-picc", "nci-terms"],
  embolization: ["radiology-embolization"],
  ablation: ["radiology-ablation"],
  diagnosis: ["nci-diagnosis", "nci-cancer", "nci-terms"],
  pet: ["radiology-pet", "nci-diagnosis"],
  xray: ["nci-diagnosis", "medline-xrays"],
  chemotherapy: ["nci-chemotherapy", "nci-side-effects"],
  radiation: ["nci-radiation", "nci-side-effects"],
  cbc: ["nci-diagnosis", "medline-cbc"],
  "bone-marrow": ["nci-diagnosis", "nci-terms"],
  "lumbar-puncture": ["nci-diagnosis", "nci-terms"],
  "side-effects": ["nci-side-effects"],
  "clinical-trial": ["nci-clinical-trials"],
};

const CATEGORY_SOURCE_IDS: Record<string, string[]> = {
  Cancer: ["nci-terms", "nci-cancer", "nci-treatments"],
  Tests: ["nci-diagnosis", "medline-cbc"],
  Imaging: ["nci-diagnosis", "radiology-ct"],
  Procedures: ["nci-diagnosis", "nci-terms"],
  Treatment: ["nci-treatments", "nci-side-effects"],
  "Side effects": ["nci-side-effects"],
  "Care team": ["nci-terms"],
  Body: ["nci-terms", "medline-anatomy"],
};

export function citations(ids: string[] = []): Citation[] {
  return ids.map(id => SOURCES.find(source => source.id === id)).filter((source): source is Citation => !!source);
}

export const topicCitations = (id: string) => citations(TOPIC_SOURCE_IDS[id] ?? []);
export const wordCitations = (category: string) => citations(CATEGORY_SOURCE_IDS[category] ?? ["nci-terms"]);
