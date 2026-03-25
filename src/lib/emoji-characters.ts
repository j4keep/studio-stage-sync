// Shared custom character emoji definitions used across Feed and Battle
import thumbsupImg from "@/assets/emojis/thumbsup.png";
import heartImg from "@/assets/emojis/heart.png";
import shockedImg from "@/assets/emojis/shocked.png";
import laughcryImg from "@/assets/emojis/laughcry.png";
import angryImg from "@/assets/emojis/angry.png";
import fireImg from "@/assets/emojis/fire.png";
import coolImg from "@/assets/emojis/cool.png";
import crownImg from "@/assets/emojis/crown.png";
import flexedImg from "@/assets/emojis/flexed.png";
import starImg from "@/assets/emojis/star.png";
import trophyImg from "@/assets/emojis/trophy.png";
import skullImg from "@/assets/emojis/skull.png";
import lightningImg from "@/assets/emojis/lightning.png";
import micImg from "@/assets/emojis/mic.png";
import rocketImg from "@/assets/emojis/rocket.png";
import diamondImg from "@/assets/emojis/diamond.png";
import clapImg from "@/assets/emojis/clap.png";
import dragonImg from "@/assets/emojis/dragon.png";
import ghostImg from "@/assets/emojis/ghost.png";
import punchImg from "@/assets/emojis/punch.png";
import tornadoImg from "@/assets/emojis/tornado.png";
import alienImg from "@/assets/emojis/alien.png";
import robotImg from "@/assets/emojis/robot.png";
import lionImg from "@/assets/emojis/lion.png";
import musicImg from "@/assets/emojis/music.png";
import hundredImg from "@/assets/emojis/hundred.png";
import snakeImg from "@/assets/emojis/snake.png";
import boomImg from "@/assets/emojis/boom.png";
import bombImg from "@/assets/emojis/bomb.png";
import rageImg from "@/assets/emojis/rage.png";
import eyesImg from "@/assets/emojis/eyes.png";
import guitarImg from "@/assets/emojis/guitar.png";
import sparklesImg from "@/assets/emojis/sparkles.png";
import moneyImg from "@/assets/emojis/money.png";
import vibingImg from "@/assets/emojis/vibing.png";
import winkImg from "@/assets/emojis/wink.png";
import mindblownImg from "@/assets/emojis/mindblown.png";
import dabImg from "@/assets/emojis/dab.png";
import peaceImg from "@/assets/emojis/peace.png";
import djImg from "@/assets/emojis/dj.png";
import danceImg from "@/assets/emojis/dance.png";
import poopImg from "@/assets/emojis/poop.png";
import trashImg from "@/assets/emojis/trash.png";
import thumbsdownImg from "@/assets/emojis/thumbsdown.png";
import stopImg from "@/assets/emojis/stop.png";
import queenImg from "@/assets/emojis/queen.png";
import waterbucket1Img from "@/assets/emojis/waterbucket1.png";
import waterbucket2Img from "@/assets/emojis/waterbucket2.png";
import waterbucket3Img from "@/assets/emojis/waterbucket3.png";
import waterbucket4Img from "@/assets/emojis/waterbucket4.png";
import waterbucket5Img from "@/assets/emojis/waterbucket5.png";
import flowersImg from "@/assets/emojis/flowers.png";
import poopbucketImg from "@/assets/emojis/poopbucket.png";

export interface EmojiCharacter {
  label: string;
  src: string;
  id: string;
}

export const EMOJI_CHARACTERS: EmojiCharacter[] = [
  { label: "Fire", src: fireImg, id: "fire" },
  { label: "Thumbs Up", src: thumbsupImg, id: "thumbsup" },
  { label: "Heart", src: heartImg, id: "heart" },
  { label: "Cool", src: coolImg, id: "cool" },
  { label: "Laugh Cry", src: laughcryImg, id: "laughcry" },
  { label: "Flexed", src: flexedImg, id: "flexed" },
  { label: "Crown", src: crownImg, id: "crown" },
  { label: "Skull", src: skullImg, id: "skull" },
  { label: "Lightning", src: lightningImg, id: "lightning" },
  { label: "Star", src: starImg, id: "star" },
  { label: "Trophy", src: trophyImg, id: "trophy" },
  { label: "Punch", src: punchImg, id: "punch" },
  { label: "Angry", src: angryImg, id: "angry" },
  { label: "Shocked", src: shockedImg, id: "shocked" },
  { label: "Dragon", src: dragonImg, id: "dragon" },
  { label: "Mic", src: micImg, id: "mic" },
  { label: "Rocket", src: rocketImg, id: "rocket" },
  { label: "Diamond", src: diamondImg, id: "diamond" },
  { label: "Clap", src: clapImg, id: "clap" },
  { label: "Ghost", src: ghostImg, id: "ghost" },
  { label: "Tornado", src: tornadoImg, id: "tornado" },
  { label: "Alien", src: alienImg, id: "alien" },
  { label: "Robot", src: robotImg, id: "robot" },
  { label: "Lion", src: lionImg, id: "lion" },
  { label: "Vibing", src: vibingImg, id: "vibing" },
  { label: "Dance", src: danceImg, id: "dance" },
  { label: "DJ", src: djImg, id: "dj" },
  { label: "Money", src: moneyImg, id: "money" },
  { label: "Peace", src: peaceImg, id: "peace" },
  { label: "Mind Blown", src: mindblownImg, id: "mindblown" },
  { label: "Poop", src: poopImg, id: "poop" },
  { label: "Trash", src: trashImg, id: "trash" },
  { label: "Thumbs Down", src: thumbsdownImg, id: "thumbsdown" },
  { label: "Stop", src: stopImg, id: "stop" },
  { label: "Queen", src: queenImg, id: "queen" },
];

// Quick lookup by id
export const EMOJI_MAP: Record<string, string> = {};
EMOJI_CHARACTERS.forEach((e) => { EMOJI_MAP[e.id] = e.src; });

// Subset for feed emoji bar (first 12 most popular)
export const FEED_EMOJI_SET = EMOJI_CHARACTERS.slice(0, 12);
