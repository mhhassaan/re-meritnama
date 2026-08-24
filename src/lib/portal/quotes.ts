/**
 * The Induction Portal's quote strip.
 *
 * The portal replaces the app's daily Quranic verse with a rotating strip of
 * medical quotations, exactly as the original does. That is a deliberate
 * difference in register rather than an inconsistency: the analysis app is
 * something a candidate reads at leisure, while the portal is where they watch
 * a live cycle decide their career. The original opens the portal with
 * physicians rather than scripture, and the list keeps its own Islamic section
 * at the top, so nothing is lost — it is moved.
 *
 * Order is the original's, grouped by tradition. Attributions are as the
 * original gives them, including its own hedging ("attributed"), because
 * silently upgrading a disputed quotation to a firm one would be inventing
 * provenance.
 */

export type Quote = { text: string; author: string };

export const PORTAL_QUOTES: Quote[] = [
  // Islamic and Quranic.
  {
    text: "For every disease Allah has created a cure.",
    author: "Prophet Muhammad ﷺ (Sahih Bukhari)",
  },
  {
    text: "Seek knowledge, even unto China.",
    author: "Prophet Muhammad ﷺ (attributed)",
  },
  {
    text: "The best of people are those most beneficial to people.",
    author: "Prophet Muhammad ﷺ",
  },
  {
    text: "Whoever saves a life, it is as though he has saved all mankind.",
    author: "Quran 5:32",
  },
  {
    text: "And We send down of the Quran that which is healing and mercy for the believers.",
    author: "Quran 17:82",
  },
  { text: "Verily, with every hardship comes ease.", author: "Quran 94:6" },
  { text: "The wound is the place where the Light enters you.", author: "Rumi" },
  {
    text: "Yesterday I was clever, so I wanted to change the world. Today I am wise, so I am changing myself.",
    author: "Rumi",
  },

  // Muslim physicians.
  { text: "Medicine is the noblest of the arts.", author: "Ibn Sina (Avicenna, 980–1037)" },
  {
    text: "The body is nourished by what it digests, and the mind by what it contemplates.",
    author: "Ibn Sina (Avicenna)",
  },
  {
    text: "The physician who knows only medicine, knows not even medicine.",
    author: "Ibn Sina (attributed)",
  },
  {
    text: "Truth in medicine is an unachievable goal, and the art as described in books is far beneath the knowledge of an experienced and thoughtful physician.",
    author: "Al-Razi (Rhazes, 854–925)",
  },

  // Hippocrates.
  {
    text: "Wherever the art of medicine is loved, there is also a love of humanity.",
    author: "Hippocrates",
  },
  { text: "First, do no harm.", author: "Hippocrates" },
  {
    text: "Life is short, and art long; the crisis fleeting; experience perilous, and decision difficult.",
    author: "Hippocrates",
  },
  {
    text: "Make a habit of two things: to help, or at least to do no harm.",
    author: "Hippocrates",
  },

  // William Osler.
  {
    text: "The good physician treats the disease; the great physician treats the patient who has the disease.",
    author: "William Osler",
  },
  {
    text: "Medicine is a science of uncertainty and an art of probability.",
    author: "William Osler",
  },
  {
    text: "The practice of medicine is an art, not a trade; a calling, not a business; a calling in which your heart will be exercised equally with your head.",
    author: "William Osler",
  },
  {
    text: "The young physician starts life with 20 drugs for each disease, and the old physician ends life with one drug for 20 diseases.",
    author: "William Osler",
  },
  {
    text: "To study the phenomena of disease without books is to sail an uncharted sea, while to study books without patients is not to go to sea at all.",
    author: "William Osler",
  },
  {
    text: "In science the credit goes to the man who convinces the world, not to the man to whom the idea first occurs.",
    author: "William Osler",
  },

  // Others.
  {
    text: "The secret of the care of the patient is in caring for the patient.",
    author: "Francis W. Peabody",
  },
  {
    text: "Medicine is not only a science; it is also an art. It deals with the very processes of life, which must be understood before they may be guided.",
    author: "Paracelsus",
  },
  {
    text: "Every patient you see is a lesson in what mankind is and what it may become.",
    author: "Edward D. Churchill",
  },
  {
    text: "It is infinitely better to transplant a heart than to bury it to be devoured by worms.",
    author: "Christiaan Barnard",
  },
  {
    text: "Medicine is a social science, and politics is nothing else but medicine on a large scale.",
    author: "Rudolf Virchow",
  },
  {
    text: "The purpose of human life is to serve, and to show compassion and the will to help others.",
    author: "Albert Schweitzer",
  },
  {
    text: "The idea that some lives matter less is the root of all that is wrong with the world.",
    author: "Paul Farmer",
  },
  {
    text: "I was taught that the way of progress is neither swift nor easy.",
    author: "Marie Curie",
  },
  {
    text: "The art of medicine consists in amusing the patient while nature cures the disease.",
    author: "Voltaire",
  },
];
