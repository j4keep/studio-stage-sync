import type { BookPage } from "@/lib/books-catalog";
import p01 from "@/assets/books/kids/sock-detective/p01.jpg";
import p02 from "@/assets/books/kids/sock-detective/p02.jpg";
import p03 from "@/assets/books/kids/sock-detective/p03.jpg";
import p04 from "@/assets/books/kids/sock-detective/p04.jpg";
import p05 from "@/assets/books/kids/sock-detective/p05.jpg";
import p06 from "@/assets/books/kids/sock-detective/p06.jpg";
import p07 from "@/assets/books/kids/sock-detective/p07.jpg";
import p08 from "@/assets/books/kids/sock-detective/p08.jpg";
import p09 from "@/assets/books/kids/sock-detective/p09.jpg";
import p10 from "@/assets/books/kids/sock-detective/p10.jpg";

/**
 * Sock Detective — YAJ Kids picture book.
 * 10 illustrated reading pages: big picture on top, 1–4 short sentences underneath.
 */
export const SOCK_DETECTIVE_PAGES: BookPage[] = [
  {
    text: `Left Sock peeked out of the laundry basket. "Where is Right?"`,
    image: p01,
  },
  {
    text: `Clue one: a sprinkle of glitter on the hallway rug.`,
    image: p02,
  },
  {
    text: `Clue two: a blue crayon rolling toward the bedroom.`,
    image: p03,
  },
  {
    text: `Clue three: a tiny trail of cookie crumbs.`,
    image: p04,
  },
  {
    text: `Left Sock tiptoed under the bed like a brave detective.`,
    image: p05,
  },
  {
    text: `A fort! Pillows. Comics. Flashlight glow.`,
    image: p06,
  },
  {
    text: `There was Right Sock, reading about sock superheroes.`,
    image: p07,
  },
  {
    text: `"Next time, invite me," Left said.`,
    image: p08,
  },
  {
    text: `They high-fived (sort of) and wiggled back to the basket.`,
    image: p09,
  },
  {
    text: `Case closed. Laundry wins!`,
    image: p10,
  },
];
