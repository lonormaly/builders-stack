import { registerRootComponent } from "expo";
import App from "./App";

// registerRootComponent = AppRegistry.registerComponent + the extra setup Expo needs
// to run in Expo Go and native builds alike.
registerRootComponent(App);
