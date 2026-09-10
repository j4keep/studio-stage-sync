import { describe, expect, it } from "vitest";
import {
  REGULAR_CATEGORIES,
  SEED_BOOKS,
  booksForCategory,
  getBookById,
  kidsBooks,
  regularBooks,
} from "./books-catalog";

describe("books-catalog", () => {
  it("has five books in each regular category", () => {
    for (const cat of REGULAR_CATEGORIES) {
      expect(booksForCategory(cat.id).length).toBeGreaterThanOrEqual(5);
    }
  });

  it("has at least ten kids books", () => {
    expect(kidsBooks().length).toBeGreaterThanOrEqual(10);
  });

  it("keeps regular and kids audiences separate", () => {
    expect(regularBooks().every((b) => b.audience === "regular")).toBe(true);
    expect(kidsBooks().every((b) => b.audience === "kids")).toBe(true);
    expect(SEED_BOOKS.length).toBeGreaterThanOrEqual(35);
  });

  it("ships Harbor Lights as a full-page adult template", () => {
    const book = getBookById("drama-harbor-lights");
    expect(book).toBeTruthy();
    expect(book!.pages.length).toBeGreaterThanOrEqual(20);
    expect(book!.coverImage).toMatch(/harbor-lights-cover\.(jpg|jpeg|png|webp|svg)/i);
    expect(book!.pages[0]?.chapter).toMatch(/Chapter/i);
    const sample = book!.pages[0]!.text;
    expect(sample.split(/\s+/).length).toBeGreaterThan(120);
  });

  it("ships Stage Left at Harbor Lights quality", () => {
    const book = getBookById("drama-stage-left");
    expect(book).toBeTruthy();
    expect(book!.pages.length).toBeGreaterThanOrEqual(20);
    expect(book!.coverImage).toMatch(/stage-left-cover\.(jpg|jpeg|png|webp|svg)/i);
    expect(book!.pages[0]?.chapter).toMatch(/Chapter/i);
    expect(book!.pages[0]!.text.split(/\s+/).length).toBeGreaterThan(120);
  });

  it("ships The Quiet Room at Harbor Lights quality", () => {
    const book = getBookById("drama-quiet-room");
    expect(book).toBeTruthy();
    expect(book!.pages.length).toBeGreaterThanOrEqual(20);
    expect(book!.coverImage).toMatch(/quiet-room-cover\.(jpg|jpeg|png|webp|svg)/i);
    expect(book!.pages[0]?.chapter).toMatch(/Chapter/i);
    expect(book!.pages[0]!.text.split(/\s+/).length).toBeGreaterThan(120);
  });

  it("ships After the Bell at Harbor Lights quality", () => {
    const book = getBookById("drama-after-the-bell");
    expect(book).toBeTruthy();
    expect(book!.pages.length).toBeGreaterThanOrEqual(20);
    expect(book!.coverImage).toMatch(/after-the-bell-cover\.(jpg|jpeg|png|webp|svg)/i);
    expect(book!.pages[0]?.chapter).toMatch(/Chapter/i);
    expect(book!.pages[0]!.text.split(/\s+/).length).toBeGreaterThan(120);
  });
});
