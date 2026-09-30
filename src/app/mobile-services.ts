import { FavoriteNotifications } from "../application/favorite-notifications";
import { PreferenceStore } from "../infrastructure/storage";
import { nativeNotifications } from "./platform";
export { hasSavedResponseFallback, publicDataFetch, rememberPublicResponse, publicNetworkOnline } from "../infrastructure/public-response-cache";
export const favoriteNotifications = new FavoriteNotifications(new PreferenceStore(), nativeNotifications);
