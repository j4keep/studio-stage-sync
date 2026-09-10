import { describe, expect, it } from "vitest";
import {
  REGULAR_CATEGORIES,
  SEED_BOOKS,
  booksForCategory,
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
});
