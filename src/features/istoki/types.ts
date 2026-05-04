export interface Region {
  code: string;
  name: string;
  geographicHint: string;
  podcasts: Podcast[];
  stories: Story[];
  chronicle: ChronicleEntry[];
}

export interface Podcast {
  id: string;
  title: string;
  description: string;
  audioUrl: string;
  durationSec: number;
  recordedAt: string;
  speakerName?: string;
}

export interface Story {
  id: string;
  participantName: string;
  ageOrRole: string;
  beforeText: string;
  afterText: string;
  manifestoQuote: string;
  photoUrl: string;
  regionContextHint?: string;
}

export interface ChronicleEntry {
  id: string;
  eventDate: string;
  eventTitle: string;
  participantsCount: number;
  keyInsights: string[];
}
