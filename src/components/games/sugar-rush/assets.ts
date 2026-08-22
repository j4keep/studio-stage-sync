import sugarRushBgAsset from "@/assets/games/sugar-rush/sugar-rush-bg.jpg.asset.json";
import candySprite0Asset from "@/assets/games/sugar-rush/candy-0.png.asset.json";
import candySprite1Asset from "@/assets/games/sugar-rush/candy-1.png.asset.json";
import candySprite2Asset from "@/assets/games/sugar-rush/candy-2.png.asset.json";
import candySprite3Asset from "@/assets/games/sugar-rush/candy-3.png.asset.json";
import candySprite4Asset from "@/assets/games/sugar-rush/candy-4.png.asset.json";
import candySprite5Asset from "@/assets/games/sugar-rush/candy-5.png.asset.json";

/** Painterly candy-land backdrop, shared across Sugar Rush's intro and maze. */
export const sugarRushBg = sugarRushBgAsset.url;

/** Illustrated candy sprites (0 red … 5 purple) — used for ambient intro decoration and
 *  as collectible art in the maze. */
export const CANDY_SPRITES = [
  candySprite0Asset.url,
  candySprite1Asset.url,
  candySprite2Asset.url,
  candySprite3Asset.url,
  candySprite4Asset.url,
  candySprite5Asset.url,
];
