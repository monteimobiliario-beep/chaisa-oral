
export interface InterviewMetadata {
  interviewId: string;
  interviewDate: string;
  interviewPlace: string;
  intervieweeName: string;
  intervieweeRin: string;
  totalNames: number;
  originalFilename?: string;
}

export interface Individual {
  id: string; // Internal UUID
  rin: number;
  relation: string; // C<n>, F<n>, F<n>,F<m>, P<k> etc
  sex: 'M' | 'F' | 'Other' | '';
  fullName: string;
  birthDate: string;
  birthPlace: string;
  deathDate: string;
  deathPlace: string;
  page: number;
  row: number;
  confidence: number;
  isDitto?: boolean;
}

export type AppState = 'IDLE' | 'PROCESSING' | 'REVIEW' | 'EXPORT' | 'LIST';

export interface FileData {
  data: string;
  mimeType: string;
}

export interface ProcessedData {
  metadata: InterviewMetadata;
  individuals: Individual[];
  sourceFiles?: FileData[]; 
}

export interface SavedSession {
  id: string;
  timestamp: string;
  data: ProcessedData;
  user_id?: string;
}

export interface AuthUser {
  id: string;
  email?: string;
}
