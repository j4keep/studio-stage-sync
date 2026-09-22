import { supabase } from "@/integrations/supabase/client";
import { dataUrlToFile } from "@/lib/video-preview";
import { deleteFromR2, generateR2Key, getR2DownloadUrl, uploadToR2 } from "@/lib/r2-storage";
import type { BookAudience, BookCategoryId, BookItem, BookListingType, BookPage } from "@/lib/books-catalog";
import { normalizeCreatorBookPages } from "@/lib/book-pagination";

export type CreatorBookRow = {
  id: string;
  user_id: string;
  title: string;
  author: string;
  audience: BookAudience;
  category: BookCategoryId;
  listing_type: BookListingType;
  price: number | string | null;
  blurb: string | null;
  cover_url: string | null;
  cover_key: string | null;
  pages: BookPage[] | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
};

export type CreatorBookDraft = {
  title: string;
  author: string;
  audience: BookAudience;
  category: BookCategoryId;
  listingType: BookListingType;
  price?: number | null;
  blurb: string;
  pages: BookPage[];
  coverUrl?: string | null;
  coverKey?: string | null;
};

function rowToBook(row: CreatorBookRow): BookItem {
  return {
    id: row.id,
    title: row.title,
    author: row.author,
    audience: row.audience,
    category: row.category,
    listingType: row.listing_type,
    price: row.price == null ? null : Number(row.price),
    coverFrom: "#111827",
    coverTo: "#6d28d9",
    coverImage: row.cover_url || undefined,
    coverStorageKey: row.cover_key || undefined,
    blurb: row.blurb || "A creator-published book on YAJ.",
    pages: normalizeCreatorBookPages(Array.isArray(row.pages) ? row.pages : [], row.audience),
    userUploaded: true,
    creatorUserId: row.user_id,
  };
}

export async function listPublishedCreatorBooks(): Promise<BookItem[]> {
  const { data, error } = await (supabase as any)
    .from("creator_books")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });
  if (error) {
    // Compatibility: older deployments may not have the migration yet.
    if (/relation .*creator_books.* does not exist|schema cache|PGRST205/i.test(error.message || "")) return [];
    throw error;
  }
  return ((data || []) as CreatorBookRow[]).map(rowToBook);
}

export async function listAllCreatorBooksForAdmin(): Promise<BookItem[]> {
  const { data, error } = await (supabase as any)
    .from("creator_books")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as CreatorBookRow[]).map(rowToBook);
}

export async function adminDeleteCreatorBook(
  adminUserId: string,
  book: BookItem,
  reason: string,
): Promise<void> {
  const { data: row, error: readError } = await (supabase as any)
    .from("creator_books")
    .select("id,user_id,title,cover_key,pages")
    .eq("id", book.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return;

  const { error: logError } = await (supabase as any)
    .from("admin_content_removals")
    .insert({
      admin_user_id: adminUserId,
      content_type: "book",
      content_id: String(book.id),
      creator_user_id: row.user_id,
      title: row.title,
      reason: reason.trim() || "Policy violation",
    });
  if (logError) throw logError;

  const { error } = await (supabase as any).from("creator_books").delete().eq("id", book.id);
  if (error) throw error;

  const keys = [
    row.cover_key,
    ...((Array.isArray(row.pages) ? row.pages : []).map((p: any) => p?.imageKey)),
  ].filter((key): key is string => typeof key === "string" && key.length > 0);
  await Promise.all(keys.map((key) => deleteFromR2(key).catch(() => {})));
}

export async function listMyCreatorBooks(userId: string): Promise<BookItem[]> {
  const { data, error } = await (supabase as any)
    .from("creator_books")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data || []) as CreatorBookRow[]).map(rowToBook);
}

export async function updateCreatorBook(userId: string, id: string, draft: CreatorBookDraft): Promise<BookItem> {
  const payload = {
    title: draft.title.trim(),
    author: draft.author.trim(),
    audience: draft.audience,
    category: draft.category,
    listing_type: draft.listingType,
    price: draft.listingType === "sale" ? draft.price ?? null : null,
    blurb: draft.blurb.trim(),
    cover_url: draft.coverUrl || null,
    cover_key: draft.coverKey || null,
    pages: draft.pages,
    status: "published",
  };
  const { data, error } = await (supabase as any)
    .from("creator_books")
    .update(payload)
    .eq("id", id)
    .eq("user_id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return rowToBook(data as CreatorBookRow);
}

export async function deleteCreatorBook(userId: string, id: string): Promise<void> {
  const { data: row, error: readError } = await (supabase as any)
    .from("creator_books")
    .select("cover_key,pages")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) throw readError;

  const { error } = await (supabase as any)
    .from("creator_books")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw error;

  const keys = [
    row?.cover_key,
    ...((Array.isArray(row?.pages) ? row.pages : []).map((p: any) => p?.imageKey)),
  ].filter((key): key is string => typeof key === "string" && key.length > 0);
  await Promise.all(keys.map((key) => deleteFromR2(key).catch(() => {})));
}

export async function listBookLibraryEntries(userId: string): Promise<{ bookId: string; acquisition: "saved" | "purchased" }[]> {
  const { data, error } = await (supabase as any)
    .from("book_library")
    .select("book_id,acquisition,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((row: any) => ({
    bookId: String(row.book_id),
    acquisition: row.acquisition === "purchased" ? "purchased" : "saved",
  }));
}

export async function saveBookToLibrary(userId: string, bookId: string): Promise<void> {
  const { data: existing, error: readError } = await (supabase as any)
    .from("book_library")
    .select("acquisition")
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .maybeSingle();
  if (readError) throw readError;
  if (existing) return;

  const { error } = await (supabase as any)
    .from("book_library")
    .insert({ user_id: userId, book_id: bookId, acquisition: "saved" });
  if (error) throw error;
}

export async function removeSavedBookFromLibrary(userId: string, bookId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from("book_library")
    .delete()
    .eq("user_id", userId)
    .eq("book_id", bookId)
    .eq("acquisition", "saved");
  if (error) throw error;
}

export async function getCreatorBookById(id: string): Promise<BookItem | null> {
  const { data, error } = await (supabase as any)
    .from("creator_books")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    if (/relation .*creator_books.* does not exist|schema cache|PGRST205/i.test(error.message || "")) return null;
    throw error;
  }
  return data ? rowToBook(data as CreatorBookRow) : null;
}

export async function publishCreatorBook(userId: string, draft: CreatorBookDraft): Promise<BookItem> {
  const payload = {
    user_id: userId,
    title: draft.title.trim(),
    author: draft.author.trim(),
    audience: draft.audience,
    category: draft.category,
    listing_type: draft.listingType,
    price: draft.listingType === "sale" ? draft.price ?? null : null,
    blurb: draft.blurb.trim(),
    cover_url: draft.coverUrl || null,
    cover_key: draft.coverKey || null,
    pages: draft.pages,
    status: "published",
  };
  const { data, error } = await (supabase as any)
    .from("creator_books")
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return rowToBook(data as CreatorBookRow);
}

function generatedImageToFile(imageUrl: string, fileName: string): File | null {
  if (!imageUrl.startsWith("data:")) return null;
  try {
    return dataUrlToFile(imageUrl, fileName);
  } catch {
    return null;
  }
}

export async function generateCreatorBookCover(args: {
  userId: string;
  title: string;
  author: string;
  category: string;
  prompt: string;
}): Promise<{ url: string; key: string | null }> {
  const { data, error } = await supabase.functions.invoke("generate-cover-image", {
    body: {
      mode: "book",
      title: args.title,
      author: args.author,
      category: args.category,
      prompt: args.prompt,
    },
  });
  if (error) throw error;
  const imageUrl = data?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error(data?.error || "No cover image was generated");
  }

  const file = generatedImageToFile(imageUrl, "yaj-book-cover.png");
  if (!file) {
    // Gateway may return a hosted URL. It can be used directly.
    return { url: imageUrl, key: null };
  }

  const key = generateR2Key(args.userId, "book-covers", `${args.title || "book"}.png`);
  const uploaded = await uploadToR2(file, { fileName: key, mimeType: file.type || "image/png" });
  if (!uploaded.success || !uploaded.data) {
    throw new Error(uploaded.error || "Generated cover could not be saved");
  }
  return { url: getR2DownloadUrl(uploaded.data.key), key: uploaded.data.key };
}


export async function generateCreatorKidsPageIllustration(args: {
  userId: string;
  title: string;
  author: string;
  pageText: string;
  pageNumber: number;
  totalPages: number;
  artDirection: string;
  previousImageKey?: string | null;
}): Promise<{ url: string; key: string | null; prompt: string }> {
  const prompt = `Page ${args.pageNumber}: ${args.pageText.slice(0, 1200)}`;
  const { data, error } = await supabase.functions.invoke("generate-cover-image", {
    body: {
      mode: "kids-book-page",
      title: args.title,
      author: args.author,
      prompt,
      pageText: args.pageText.slice(0, 1800),
      pageNumber: args.pageNumber,
      totalPages: args.totalPages,
      artDirection: args.artDirection,
    },
  });
  if (error) throw error;

  const imageUrl = data?.imageUrl;
  if (!imageUrl || typeof imageUrl !== "string") {
    throw new Error(data?.error || "No page illustration was generated");
  }

  let url = imageUrl;
  let key: string | null = null;
  const file = generatedImageToFile(imageUrl, `page-${args.pageNumber}.png`);

  if (file) {
    const requestedKey = generateR2Key(
      args.userId,
      "book-pages",
      `${args.title || "book"}-page-${args.pageNumber}.png`,
    );
    const uploaded = await uploadToR2(file, {
      fileName: requestedKey,
      mimeType: file.type || "image/png",
    });
    if (!uploaded.success || !uploaded.data) {
      throw new Error(uploaded.error || "Page illustration could not be saved");
    }
    key = uploaded.data.key;
    url = getR2DownloadUrl(uploaded.data.key);
  }

  if (key && args.previousImageKey && args.previousImageKey !== key) {
    void deleteFromR2(args.previousImageKey).catch(() => {});
  }

  return { url, key, prompt };
}
