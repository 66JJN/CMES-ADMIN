// Deprecated: This legacy home.js has been fully refactored.
// All layout compositions have been split into components under components/dashboard/ and components/ui/,
// business logic into custom hooks under hooks/, and composed in pages/Home.jsx.
// Please use pages/Home.jsx going forward.

import React from 'react';
import HomeComposer from '../pages/Home';

export default function Home() {
  return <HomeComposer />;
}
export { HomeComposer as LegacyHome };
