import { app } from "electron";

export const getLocal = () => app.getLocale();

export const isChineseLocale = () => getLocal().startsWith("zh");
