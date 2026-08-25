import "server-only";

/**
 * The supporters list, as published on the original's donate page.
 *
 * ## Why this is a module and not a file in `public/`
 *
 * It is 185 names. Anything under `public/` is served verbatim with no
 * authentication, which would republish the whole list at a guessable URL —
 * the exact shape of the original's failure. Here it is bundled into a server
 * component behind the `(app)` sign-in gate.
 *
 * ## Two things were cleaned on the way in, not on the way out
 *
 * The same rule `pool-directory.mjs` and `joining-status.mjs` apply, and for
 * the same reason: a value that never enters the repository cannot be leaked by
 * a later mistake.
 *
 * - **Parentage stripped.** 143 of the 185 names on the live page carry a
 *   father's name — "Firstname Lastname D/O Father Name". Every other surface
 *   in this rebuild strips that, and a page that prints the amount somebody gave
 *   beside their name is not where to make the exception.
 * - **One entry withheld.** A supporter typed their **email address** into the
 *   name box, and the live page publishes it. Same class as the three
 *   candidates who typed a CNIC into the pool's name field. It renders as
 *   "Anonymous supporter" with the amount and date intact.
 *
 * Everything else — every name, every amount, every date, and the totals — is
 * the original's, carried across.
 *
 * ## The figures are a snapshot and say so on the page
 *
 * There is no feed behind them. They were read off the live page on the date
 * below and will not move until somebody updates this file.
 */

export type Supporter = {
  /** Null when the source value was not a usable name. */
  name: string | null;
  /** Null where the live page shows a dash rather than an amount. */
  usd: number | null;
  date: string;
};

/** The headline figures, as printed on the original. */
export const SUPPORT_TOTALS = {
  raisedUsd: 174.73,
  raisedPkr: 48_536,
  supporters: 185,
  perFetchUsd: 2.4,
  asOf: "2026-08-25",
} as const;

export const SUPPORTERS: Supporter[] = [
  { name: "Qura Tul Ain Malik", usd: 1.8, date: "12 Jul 2026" },
  { name: "Fatima Saqib", usd: 0.9, date: "6 Jul 2026" },
  { name: "Nabiha Khalid", usd: 0.9, date: "6 Jul 2026" },
  { name: "Maham Saleem", usd: 0.9, date: "5 Jul 2026" },
  { name: "Muhammad Saadat Ali", usd: 0.9, date: "4 Jul 2026" },
  { name: "Shaheer Ahmed", usd: 0.9, date: "4 Jul 2026" },
  { name: "Abdul Rehman Hamid", usd: 0.9, date: "4 Jul 2026" },
  { name: "Areej Amjad", usd: 0.9, date: "2 Jul 2026" },
  { name: "Hussnain Munir", usd: 0.9, date: "2 Jul 2026" },
  { name: "Sayeda Rafia Salam", usd: 0.9, date: "30 Jun 2026" },
  { name: "Daniyal Akhtar Ghumman", usd: 0.9, date: "30 Jun 2026" },
  { name: "Muhammad Mudasar Nawaz", usd: 0.9, date: "30 Jun 2026" },
  { name: "Fatima Faheem", usd: 0.9, date: "27 Jun 2026" },
  { name: "Areeba Tariq", usd: 0.9, date: "27 Jun 2026" },
  { name: "Maira Arif", usd: 0.9, date: "27 Jun 2026" },
  { name: "Maria Jabeen", usd: 0.9, date: "26 Jun 2026" },
  { name: "Uzma Sattar", usd: 0.9, date: "26 Jun 2026" },
  { name: "HAFSA NOOR", usd: 0.9, date: "26 Jun 2026" },
  { name: "Muhammad Irfan Khan", usd: 0.9, date: "26 Jun 2026" },
  { name: "Ayesha Bibi", usd: 0.9, date: "26 Jun 2026" },
  { name: "Muhammad Owais Malik", usd: 0.9, date: "26 Jun 2026" },
  { name: "Marryam Farooq", usd: 2.41, date: "26 Jun 2026" },
  { name: "Majeeb Ur Rehman", usd: 0.9, date: "26 Jun 2026" },
  { name: "Aleena Akram", usd: 0.9, date: "26 Jun 2026" },
  { name: "Muhammad Ibrahim", usd: 0.9, date: "26 Jun 2026" },
  { name: "Malik Muhammad Awais", usd: 0.9, date: "25 Jun 2026" },
  { name: "Muhammad Usama Sohail", usd: 0.9, date: "25 Jun 2026" },
  { name: "MALIK MUHAMMAD AWAIS", usd: 0.9, date: "25 Jun 2026" },
  { name: "Maryam Rafique", usd: 0.9, date: "25 Jun 2026" },
  { name: "Muhammad Feroz Khan", usd: 1.08, date: "24 Jun 2026" },
  { name: "Irmeen Arooj", usd: 0.9, date: "24 Jun 2026" },
  { name: "Rida Fatima", usd: 1.44, date: "24 Jun 2026" },
  { name: "Kainat Sharif", usd: 1.08, date: "24 Jun 2026" },
  { name: "Hassaan Falak Baloch", usd: 0.9, date: "24 Jun 2026" },
  { name: "Muhammad Bilal Karim", usd: 0.9, date: "24 Jun 2026" },
  { name: "Ayesha Yasin", usd: 0.9, date: "24 Jun 2026" },
  { name: "Aleeza Irfan", usd: 0.9, date: "24 Jun 2026" },
  { name: "Syed Awab Ali", usd: 0.9, date: "24 Jun 2026" },
  { name: "Kashaf Imtiaz", usd: 0.9, date: "24 Jun 2026" },
  { name: "SAMEEN ZAHID", usd: 0.9, date: "24 Jun 2026" },
  { name: "Muhammad Rizwan", usd: 0.9, date: "24 Jun 2026" },
  { name: "Mohammad Nouman", usd: 0.9, date: "24 Jun 2026" },
  { name: "Huzefa Mohsin", usd: 0.9, date: "24 Jun 2026" },
  { name: "ABDUR REHMAN", usd: 1.08, date: "23 Jun 2026" },
  { name: "Muhammad Shaheer Naveed", usd: 0.9, date: "23 Jun 2026" },
  { name: "Jam Muhammad Ahmad", usd: 2.41, date: "23 Jun 2026" },
  { name: "Muhammad Jahangir", usd: 0.9, date: "23 Jun 2026" },
  { name: "Muhammad Bilal", usd: 0.9, date: "23 Jun 2026" },
  { name: "Saqlain Basit", usd: 1.08, date: "23 Jun 2026" },
  { name: "Saira Zafar", usd: 0.9, date: "23 Jun 2026" },
  { name: "Dur E Shehwar", usd: 0.9, date: "23 Jun 2026" },
  { name: "Kunza Suleman", usd: 0.9, date: "23 Jun 2026" },
  { name: "Ghulam Shahid", usd: 0.9, date: "22 Jun 2026" },
  { name: "Khadija Ehsan", usd: 0.9, date: "22 Jun 2026" },
  { name: "Zonaira Aleem", usd: 1.08, date: "22 Jun 2026" },
  { name: "Muhammad Faique Anwar", usd: 0.9, date: "22 Jun 2026" },
  { name: "Amna Ahmad Aziz", usd: 0.9, date: "22 Jun 2026" },
  { name: "Muhammad Aitzaz Anas", usd: 0.9, date: "22 Jun 2026" },
  { name: "Nabila Awan", usd: 0.9, date: "22 Jun 2026" },
  { name: "Hasaan Abdul Rahman", usd: 0.9, date: "21 Jun 2026" },
  { name: "Faria Iqbal", usd: 0.9, date: "21 Jun 2026" },
  { name: "Moiza Alam", usd: 0.9, date: "20 Jun 2026" },
  { name: "Muhammad Saffiullah", usd: 0.9, date: "20 Jun 2026" },
  { name: "Salman Khan", usd: 0.9, date: "20 Jun 2026" },
  { name: "Ayesha Siddique", usd: 0.9, date: "20 Jun 2026" },
  { name: "Taha Hassan Habib", usd: 0.9, date: "20 Jun 2026" },
  { name: "Abdul Moeed", usd: 1.08, date: "19 Jun 2026" },
  { name: "Umer Haider", usd: 0.9, date: "19 Jun 2026" },
  { name: "Usman Baig", usd: 0.9, date: "19 Jun 2026" },
  { name: "Ayesha Safi", usd: 0.9, date: "18 Jun 2026" },
  { name: "Aqsa Altaf", usd: 0.9, date: "18 Jun 2026" },
  { name: "Muhammad Noman Rasheed", usd: 1.08, date: "18 Jun 2026" },
  { name: "Kainat Hussun", usd: null, date: "18 Jun 2026" },
  { name: "Ahmad Bakhsh", usd: 0.9, date: "18 Jun 2026" },
  { name: "Javeria Idrees", usd: 0.9, date: "18 Jun 2026" },
  { name: "Muhammad Abrar", usd: 0.9, date: "18 Jun 2026" },
  { name: "Raffay Akram", usd: null, date: "17 Jun 2026" },
  { name: "Rabbia Zainab", usd: 0.9, date: "17 Jun 2026" },
  { name: "Berry", usd: 1.01, date: "17 Jun 2026" },
  { name: "Hassan Waheed", usd: 0.9, date: "17 Jun 2026" },
  { name: "Isbah Shoukat", usd: 0.9, date: "16 Jun 2026" },
  { name: "Maira Dua", usd: 0.9, date: "16 Jun 2026" },
  { name: "Hamna Aamir Qureshi", usd: 0.94, date: "16 Jun 2026" },
  { name: "Tayyaba Jamshaid", usd: 0.9, date: "15 Jun 2026" },
  { name: "Rubab Fatimaa", usd: 1.08, date: "15 Jun 2026" },
  { name: "Ahmad Raza", usd: 0.9, date: "15 Jun 2026" },
  { name: "Ehsan Ul Haq", usd: 1.44, date: "14 Jun 2026" },
  { name: "Muhammad Akif Khan", usd: 0.9, date: "14 Jun 2026" },
  { name: "Fatima Riaz", usd: 0.9, date: "14 Jun 2026" },
  { name: "Mishkat Rafique", usd: 0.9, date: "14 Jun 2026" },
  { name: "Rukhama Rauf", usd: null, date: "14 Jun 2026" },
  { name: "Ahsan Shoukat", usd: 0.9, date: "14 Jun 2026" },
  { name: "Ali Sher", usd: null, date: "14 Jun 2026" },
  { name: "Muhammad Mubashir Yasin", usd: 0.9, date: "14 Jun 2026" },
  { name: "Nabeel Hassan", usd: 1.8, date: "14 Jun 2026" },
  { name: "Javeria Riaz", usd: 0.9, date: "14 Jun 2026" },
  { name: "Isha Kaleem", usd: 0.9, date: "14 Jun 2026" },
  { name: null, usd: 0.9, date: "14 Jun 2026" },
  { name: "Ammara Basit", usd: 0.9, date: "13 Jun 2026" },
  { name: "Nafeesa Tanveer", usd: 1.08, date: "13 Jun 2026" },
  { name: "Saman Sajjad Sahi", usd: 0.9, date: "13 Jun 2026" },
  { name: "Ahmad Ibrahim Hassan", usd: 0.9, date: "13 Jun 2026" },
  { name: "Ayesha", usd: null, date: "13 Jun 2026" },
  { name: "Muhammad Ihtisham", usd: 0.9, date: "13 Jun 2026" },
  { name: "Muhammad Waqas", usd: 0.9, date: "13 Jun 2026" },
  { name: "Usman Habib", usd: 0.9, date: "13 Jun 2026" },
  { name: "Muhammad Aqib Riaz", usd: 0.9, date: "13 Jun 2026" },
  { name: "QAISER ALI", usd: 0.9, date: "13 Jun 2026" },
  { name: "Taymia Tariq", usd: 0.9, date: "13 Jun 2026" },
  { name: "Zara Asif", usd: 0.9, date: "12 Jun 2026" },
  { name: "Noman Khan", usd: 0.9, date: "12 Jun 2026" },
  { name: "Ammar Tassawar Sheikh", usd: 0.9, date: "12 Jun 2026" },
  { name: "Muhammad Saad Furqan Khan", usd: 0.9, date: "12 Jun 2026" },
  { name: "Aqsa Irshad", usd: 1.08, date: "12 Jun 2026" },
  { name: "Shahrose Khan", usd: 0.9, date: "12 Jun 2026" },
  { name: "Faiza Jabeen", usd: 0.9, date: "12 Jun 2026" },
  { name: "Hamna Shafqat", usd: 0.9, date: "12 Jun 2026" },
  { name: "Ali Hamza", usd: 0.9, date: "12 Jun 2026" },
  { name: "HAFIZ HAROON TARIQ", usd: 0.9, date: "12 Jun 2026" },
  { name: "Muhammad Muzammil", usd: null, date: "12 Jun 2026" },
  { name: "Mirza Salman Yousaf", usd: 0.9, date: "12 Jun 2026" },
  { name: "Ahsan Ali", usd: 1.08, date: "12 Jun 2026" },
  { name: "Sheraz Gulzar", usd: 0.94, date: "11 Jun 2026" },
  { name: "MUHAMMAD ABUZAR", usd: 0.9, date: "11 Jun 2026" },
  { name: "Bushra Falak", usd: 0.9, date: "11 Jun 2026" },
  { name: "Muhammad Hassan Laique", usd: 1.08, date: "11 Jun 2026" },
  { name: "Shaiza Mehmood", usd: 0.9, date: "11 Jun 2026" },
  { name: "Anzla Bilal", usd: 0.9, date: "11 Jun 2026" },
  { name: "M. Dilshad Azhar", usd: 1.08, date: "11 Jun 2026" },
  { name: "Mohammad Idrees", usd: null, date: "10 Jun 2026" },
  { name: "Maria Ishfaq", usd: 0.9, date: "10 Jun 2026" },
  { name: "Muhammad Ahmad Mehmood", usd: 0.9, date: "10 Jun 2026" },
  { name: "Hafiz Muhammad Abdullah", usd: 1.08, date: "10 Jun 2026" },
  { name: "Waqar Shaheen", usd: 0.9, date: "10 Jun 2026" },
  { name: "MUHAMMAD ZUBAIR", usd: 0.9, date: "10 Jun 2026" },
  { name: "Ayesha Aman Malik", usd: 0.9, date: "10 Jun 2026" },
  { name: "Abdullah Javaid", usd: 0.9, date: "10 Jun 2026" },
  { name: "Usama Nazir", usd: 0.9, date: "10 Jun 2026" },
  { name: "Muhammad Ali", usd: 1.08, date: "10 Jun 2026" },
  { name: "Yahya Farooq", usd: 0.9, date: "10 Jun 2026" },
  { name: "Syed Ahmad Nawaz Shah", usd: 0.9, date: "10 Jun 2026" },
  { name: "Nawal Noor", usd: 0.9, date: "10 Jun 2026" },
  { name: "Kashmala Abbas", usd: 0.9, date: "10 Jun 2026" },
  { name: "Aqsa Iqbal", usd: 0.9, date: "10 Jun 2026" },
  { name: "Asad Ullah Khan", usd: 0.9, date: "10 Jun 2026" },
  { name: "Sikandar Rafique", usd: 0.94, date: "9 Jun 2026" },
  { name: "Zunair Aqeel", usd: 0.9, date: "9 Jun 2026" },
  { name: "Amara Zaheer", usd: 1.08, date: "9 Jun 2026" },
  { name: "Altamas Fatima", usd: 0.9, date: "9 Jun 2026" },
  { name: "Zohaib Anjum", usd: 0.9, date: "9 Jun 2026" },
  { name: "Sheraz Gulzar", usd: 0.94, date: "9 Jun 2026" },
  { name: "Fatima Ihsan", usd: 1.08, date: "9 Jun 2026" },
  { name: "Sikander Rafique", usd: 0.94, date: "9 Jun 2026" },
  { name: "Mishkat Rafique", usd: 0.9, date: "9 Jun 2026" },
  { name: "Taqdees Shahzad", usd: 0.9, date: "8 Jun 2026" },
  { name: "Arshia Hira", usd: 0.9, date: "8 Jun 2026" },
  { name: "Umar Mehmood", usd: 0.9, date: "8 Jun 2026" },
  { name: "Muaviya Raza", usd: 1.08, date: "8 Jun 2026" },
  { name: "Salman Riaz", usd: 0.9, date: "8 Jun 2026" },
  { name: "Ahmed Rafiq", usd: 0.9, date: "8 Jun 2026" },
  { name: "Mubashir Ali", usd: 0.94, date: "8 Jun 2026" },
  { name: "Amna Atif", usd: 0.9, date: "8 Jun 2026" },
  { name: "Hafiz Muhammad Usama Zuhair", usd: 0.9, date: "8 Jun 2026" },
  { name: "Mujadid Rasool", usd: 0.9, date: "8 Jun 2026" },
  { name: "Iqra Afzal", usd: 0.9, date: "8 Jun 2026" },
  { name: "Ahmed Muneeb", usd: 0.9, date: "8 Jun 2026" },
  { name: "Sabeen Fatima", usd: 0.9, date: "8 Jun 2026" },
  { name: "Romaisa Malik", usd: 0.9, date: "8 Jun 2026" },
  { name: "Arbab Meesam", usd: 1.26, date: "8 Jun 2026" },
  { name: "Umair Asif", usd: 0.9, date: "8 Jun 2026" },
  { name: "Zain Ahmad Zaki", usd: 0.9, date: "8 Jun 2026" },
  { name: "Rafay Akram", usd: 1.08, date: "8 Jun 2026" },
  { name: "Asad Aslam", usd: 0.9, date: "8 Jun 2026" },
  { name: "Muhammad Hassan Rana", usd: 0.9, date: "8 Jun 2026" },
  { name: "Aasma Javed", usd: 0.9, date: "8 Jun 2026" },
  { name: "Asif Maqbool", usd: 0.9, date: "8 Jun 2026" },
  { name: "Yahya Sadiq", usd: 0.9, date: "8 Jun 2026" },
  { name: "Maria Saeed", usd: 0.9, date: "8 Jun 2026" },
  { name: "Naima Riaz", usd: 0.9, date: "8 Jun 2026" },
  { name: "Salman Sani", usd: 0.9, date: "7 Jun 2026" },
  { name: "Maria Saeed", usd: 0.9, date: "7 Jun 2026" },
  { name: "Ahmed Rafique", usd: 0.9, date: "7 Jun 2026" },
  { name: "Muhammad Muaz Qamar", usd: 3.6, date: "6 Jun 2026" },
  { name: "Waleed ur Rehman", usd: 1.8, date: "3 Jun 2026" },
  { name: "Mubashir", usd: 1.8, date: "29 May 2026" },
];
