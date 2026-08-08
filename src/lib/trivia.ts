export type TriviaQuestion = {
  q: string;
  options: string[];
  a: number;
  category: string;
};

export const TRIVIA_BANK: TriviaQuestion[] = [
  { q: "Which artist released the album 'Thriller'?", options: ["Prince", "Michael Jackson", "Stevie Wonder", "Lionel Richie"], a: 1, category: "Music" },
  { q: "How many keys are on a standard piano?", options: ["76", "88", "92", "61"], a: 1, category: "Music" },
  { q: "Which rapper founded Roc-A-Fella Records?", options: ["Nas", "Jay-Z", "Diddy", "Dr. Dre"], a: 1, category: "Music" },
  { q: "'Bohemian Rhapsody' was recorded by which band?", options: ["Queen", "The Beatles", "The Who", "Pink Floyd"], a: 0, category: "Music" },
  { q: "Which instrument has 6 strings by default?", options: ["Violin", "Guitar", "Cello", "Banjo"], a: 1, category: "Music" },
  { q: "Who directed the movie 'Get Out'?", options: ["Spike Lee", "Jordan Peele", "Ryan Coogler", "Barry Jenkins"], a: 1, category: "Movies" },
  { q: "Which movie features the character Vito Corleone?", options: ["Goodfellas", "Scarface", "The Godfather", "Casino"], a: 2, category: "Movies" },
  { q: "In 'The Lion King', what is Simba's father's name?", options: ["Mufasa", "Scar", "Rafiki", "Zazu"], a: 0, category: "Movies" },
  { q: "Which studio produces the Marvel Cinematic Universe?", options: ["DC Studios", "Marvel Studios", "Pixar", "Lionsgate"], a: 1, category: "Movies" },
  { q: "How many players are on the court per NBA team?", options: ["5", "6", "7", "11"], a: 0, category: "Sports" },
  { q: "Which sport uses a shuttlecock?", options: ["Squash", "Badminton", "Tennis", "Pickleball"], a: 1, category: "Sports" },
  { q: "How long is a marathon?", options: ["21.1 km", "42.2 km", "50 km", "30 km"], a: 1, category: "Sports" },
  { q: "Which country won the 2018 FIFA World Cup?", options: ["Brazil", "Germany", "France", "Croatia"], a: 2, category: "Sports" },
  { q: "How many points is a touchdown worth in the NFL?", options: ["3", "6", "7", "8"], a: 1, category: "Sports" },
  { q: "What is the capital of Japan?", options: ["Osaka", "Kyoto", "Tokyo", "Seoul"], a: 2, category: "World" },
  { q: "Which is the largest ocean?", options: ["Atlantic", "Indian", "Arctic", "Pacific"], a: 3, category: "World" },
  { q: "How many continents are there?", options: ["5", "6", "7", "8"], a: 2, category: "World" },
  { q: "Which river runs through Egypt?", options: ["Amazon", "Nile", "Congo", "Danube"], a: 1, category: "World" },
  { q: "What is the tallest mountain above sea level?", options: ["K2", "Denali", "Everest", "Kilimanjaro"], a: 2, category: "World" },
  { q: "What does 'CPU' stand for?", options: ["Central Processing Unit", "Computer Power Unit", "Core Program Utility", "Central Program Unit"], a: 0, category: "Tech" },
  { q: "Which company created the iPhone?", options: ["Samsung", "Apple", "Google", "Nokia"], a: 1, category: "Tech" },
  { q: "What does 'HTTP' transfer?", options: ["Hypertext", "Hardware", "Hashes", "Hosts"], a: 0, category: "Tech" },
  { q: "How many bits are in a byte?", options: ["4", "8", "16", "32"], a: 1, category: "Tech" },
  { q: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], a: 1, category: "Science" },
  { q: "What gas do plants absorb?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Helium"], a: 2, category: "Science" },
  { q: "Water freezes at what Celsius temperature?", options: ["0", "10", "-10", "32"], a: 0, category: "Science" },
  { q: "How many bones are in the adult human body?", options: ["186", "206", "226", "246"], a: 1, category: "Science" },
  { q: "What is the chemical symbol for gold?", options: ["Ag", "Go", "Au", "Gd"], a: 2, category: "Science" },
];

export const TRIVIA_ROUND = 8;

export function pickQuestions(count = TRIVIA_ROUND): number[] {
  const ids = TRIVIA_BANK.map((_, i) => i);
  for (let i = ids.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, count);
}

/** The computer answers correctly about 65% of the time. */
export function computerAnswer(questionIndex: number): number {
  const q = TRIVIA_BANK[questionIndex];
  if (Math.random() < 0.65) return q.a;
  const wrong = q.options.map((_, i) => i).filter((i) => i !== q.a);
  return wrong[Math.floor(Math.random() * wrong.length)];
}
