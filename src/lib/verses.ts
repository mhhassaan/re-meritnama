/**
 * Rotating Quranic verses shown across the candidate app.
 *
 * Carried over verbatim from the original `app.js` VERSES array — same ten
 * verses, same translations, same references. This is not decoration: the
 * product's stated purpose puts emotional support alongside prediction and
 * decision support, and this is where that shows up on every screen.
 *
 * Verse text is reproduced exactly and must not be paraphrased, re-translated,
 * or "improved". If more are ever added they need proper sourcing rather than
 * being generated.
 */

export type Verse = {
  arabic: string;
  translation: string;
  reference: string;
};

export const VERSES: readonly Verse[] = [
  {
    arabic: "فَإِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "So verily, with hardship comes ease.",
    reference: "Surah Al-Inshirah 94:5",
  },
  {
    arabic: "إِنَّ مَعَ الْعُسْرِ يُسْرًا",
    translation: "Indeed, with hardship will be ease.",
    reference: "Surah Al-Inshirah 94:6",
  },
  {
    arabic: "وَلَا تَيْأَسُوا مِن رَّوْحِ اللَّهِ",
    translation: "Do not despair of the mercy of Allah.",
    reference: "Surah Yusuf 12:87",
  },
  {
    arabic: "وَمَن يَتَوَكَّلْ عَلَى اللَّهِ فَهُوَ حَسْبُهُ",
    translation: "Whoever relies upon Allah — He is sufficient for him.",
    reference: "Surah At-Talaq 65:3",
  },
  {
    arabic: "إِنَّ اللَّهَ لَا يُضِيعُ أَجْرَ الْمُحْسِنِينَ",
    translation: "Allah does not allow the reward of the doers of good to be lost.",
    reference: "Surah At-Tawbah 9:120",
  },
  {
    arabic: "وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ",
    translation: "Perhaps you dislike a thing and it is good for you.",
    reference: "Surah Al-Baqarah 2:216",
  },
  {
    arabic: "وَقُل رَّبِّ زِدْنِي عِلْمًا",
    translation: "And say: My Lord, increase me in knowledge.",
    reference: "Surah Ta-Ha 20:114",
  },
  {
    arabic: "حَسْبُنَا اللَّهُ وَنِعْمَ الْوَكِيلُ",
    translation:
      "Allah is sufficient for us, and He is the best disposer of affairs.",
    reference: "Surah Ali 'Imran 3:173",
  },
  {
    arabic: "وَلَسَوْفَ يُعْطِيكَ رَبُّكَ فَتَرْضَىٰ",
    translation: "Your Lord is going to give you, and you will be satisfied.",
    reference: "Surah Ad-Duha 93:5",
  },
  {
    arabic: "أَلَمْ نَشْرَحْ لَكَ صَدْرَكَ",
    translation:
      "Did We not expand for you your chest — and relieve you of your burden?",
    reference: "Surah Al-Inshirah 94:1",
  },
] as const;

/**
 * Returns the verse for a given day, the same one for every viewer.
 *
 * Deliberately changed from the original, which picked at random on every page
 * load despite being called `showDailyVerse`. Two reasons:
 *
 *   1. A random pick differs between the server render and the client render,
 *      which is a React hydration mismatch — the same class of bug as
 *      `toLocaleDateString()`.
 *   2. Re-rolling on every navigation makes the verse feel like a slot machine.
 *      One verse per day is what the original's own function name promised, and
 *      it gives the candidate something stable to return to.
 *
 * UTC so every viewer sees the same verse regardless of time zone.
 */
export function verseOfTheDay(now: Date = new Date()): Verse {
  const daysSinceEpoch = Math.floor(now.getTime() / 86_400_000);
  return VERSES[daysSinceEpoch % VERSES.length];
}
