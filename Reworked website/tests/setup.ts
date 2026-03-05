/**
 * Test environment setup.
 * Registers happy-dom globals (window, document, etc.) so React component
 * imports that reference browser APIs don't crash during unit tests.
 */
import { GlobalRegistrator } from '@happy-dom/global-registrator';
GlobalRegistrator.register();
