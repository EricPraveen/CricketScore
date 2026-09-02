import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { initDB } from '../db/database';

export default function RootLayout() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="setup" />
      <Stack.Screen name="toss" />
      <Stack.Screen name="scoring" />
      <Stack.Screen name="scorecard" />
    </Stack>
  );
}