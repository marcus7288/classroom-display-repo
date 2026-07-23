// Phase 1 built-in placeholder content. This lets the display work fully
// standalone before any Google Sheet exists, and doubles as the offline
// fallback if the Sheet/Function is ever unreachable (see dataSource.js).
//
// Shape matches exactly what dataSource.js expects from the CSV or Function
// paths: { schedule: [...], media: [...], lessons: [...], updatedAt }.

const ROOMS = ["blue", "green", "yellow"];

const SCHEDULE_TEMPLATE = [
  { StartTime: "08:30", Scene: "wallpaper", MediaRef: "", Notes: "Room open, quiet wallpaper" },
  { StartTime: "09:00", Scene: "arrival", MediaRef: "Arrival Chimes", Notes: "Greet families" },
  { StartTime: "09:15", Scene: "story", MediaRef: "Calm Piano", Notes: "Circle time" },
  { StartTime: "09:35", Scene: "lesson", MediaRef: "Noah's Ark", Notes: "Flannel graph" },
  { StartTime: "09:50", Scene: "play", MediaRef: "Play Beats", Notes: "Free play" },
  { StartTime: "10:20", Scene: "cleanup", MediaRef: "Clean-Up Song", Notes: "Tidy toys" },
  { StartTime: "10:30", Scene: "wallpaper", MediaRef: "", Notes: "Pickup" },
];

const MEDIA = [
  // Blank URL_or_Album is intentional: audio.js falls back to a short
  // built-in generated tone for each of these when no URL is present.
  { Name: "Arrival Chimes", Type: "audio", URL_or_Album: "", LoopYN: "Y", Notes: "Placeholder tone" },
  { Name: "Calm Piano", Type: "audio", URL_or_Album: "", LoopYN: "Y", Notes: "Placeholder tone" },
  { Name: "Play Beats", Type: "audio", URL_or_Album: "", LoopYN: "Y", Notes: "Placeholder tone" },
  { Name: "Clean-Up Song", Type: "audio", URL_or_Album: "", LoopYN: "Y", Notes: "Always the same track by design" },
];

const LESSONS = [
  { LessonName: "Noah's Ark", Order: 1, ImageURL: "/assets/lessons/ark-1.svg", Caption: "God told Noah to build a big boat." },
  { LessonName: "Noah's Ark", Order: 2, ImageURL: "/assets/lessons/ark-2.svg", Caption: "The animals came two by two." },
  { LessonName: "Noah's Ark", Order: 3, ImageURL: "/assets/lessons/ark-3.svg", Caption: "Rain fell for forty days and nights." },
  { LessonName: "Noah's Ark", Order: 4, ImageURL: "/assets/lessons/ark-4.svg", Caption: "God kept Noah and the animals safe." },
  { LessonName: "Noah's Ark", Order: 5, ImageURL: "/assets/lessons/ark-5.svg", Caption: "A rainbow was God's promise!" },
];

export function getPlaceholderPlan(room) {
  const schedule = ROOMS.flatMap((r) =>
    SCHEDULE_TEMPLATE.map((row) => ({ Room: r, ...row }))
  ).filter((row) => !room || row.Room === room);

  return {
    schedule,
    media: MEDIA,
    lessons: LESSONS,
    updatedAt: new Date(0).toISOString(), // epoch marks this as placeholder, not a live fetch
  };
}
