/**
 * Drone Lab — boot.
 */

import './styles/base.css';
import './styles/lab.css';
import { startLab } from './workshop/lab';
import { crafts, roster } from './crafts';
import { registerServiceWorker } from './pwa';

startLab(crafts, roster);
registerServiceWorker();
