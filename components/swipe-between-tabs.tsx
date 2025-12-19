import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { PropsWithChildren, useMemo, useRef } from "react";
import { Dimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";

type TabKey = "index" | "messages" | "upload" | "profile";

const TAB_ORDER: TabKey[] = ["index", "messages", "upload", "profile"];

const TAB_PATH: Record<TabKey, string> = {
  index: "/(tabs)",
  messages: "/(tabs)/messages",
  upload: "/(tabs)/upload",
  profile: "/(tabs)/profile",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function SwipeBetweenTabs({
  current,
  disabled,
  edgeOnly = false,
  edgeWidth = 32,
  children,
}: PropsWithChildren<{
  current: TabKey;
  disabled?: boolean;
  /** If true, only swipes that start near screen edges will navigate (reduces conflicts with horizontal lists). */
  edgeOnly?: boolean;
  edgeWidth?: number;
}>) {
  const currentIndex = TAB_ORDER.indexOf(current);
  const isNavigatingRef = useRef(false);

  const goToIndex = (nextIndex: number) => {
    if (disabled) return;
    if (nextIndex < 0 || nextIndex >= TAB_ORDER.length) return;
    if (nextIndex === currentIndex) return;

    // prevent multiple navigations during a single gesture burst
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    const nextKey = TAB_ORDER[nextIndex];
    router.replace(TAB_PATH[nextKey] as any);

    // release after a short delay
    setTimeout(() => {
      isNavigatingRef.current = false;
    }, 300);
  };

  const fireHaptic = () => {
    // Subtle haptic on successful tab switch.
    Haptics.selectionAsync().catch(() => {});
  };

  const pan = useMemo(() => {
    return (
      Gesture.Pan()
        // Prefer a deliberate horizontal swipe
        .activeOffsetX([-20, 20])
        .failOffsetY([-20, 20])
        .onEnd((e) => {
          if (disabled) return;

          // Optionally require the swipe to start at screen edges to avoid fighting horizontal carousels.
          if (edgeOnly) {
            const startX = e.absoluteX - e.translationX;
            const isFromLeftEdge = startX <= edgeWidth;
            const isFromRightEdge = startX >= SCREEN_WIDTH - edgeWidth;
            if (!isFromLeftEdge && !isFromRightEdge) return;
          }

          const dx = e.translationX;
          const vx = e.velocityX;

          const SWIPE_DISTANCE = 60;
          const SWIPE_VELOCITY = 450;

          const isSwipe = Math.abs(dx) > SWIPE_DISTANCE || Math.abs(vx) > SWIPE_VELOCITY;
          if (!isSwipe) return;

          // Swipe left -> next tab. Swipe right -> previous tab.
          if (dx < 0) {
            runOnJS(fireHaptic)();
            runOnJS(goToIndex)(currentIndex + 1);
          } else {
            runOnJS(fireHaptic)();
            runOnJS(goToIndex)(currentIndex - 1);
          }
        })
    );
  }, [currentIndex, disabled, edgeOnly, edgeWidth]);

  if (!edgeOnly) {
    // Full-screen swipe (may conflict with ScrollView/FlatList horizontal/vertical gestures).
    return <GestureDetector gesture={pan}>{children as any}</GestureDetector>;
  }

  // Edge-only swipe zones so we don't fight ScrollViews/FlatLists (touch starts on our overlay).
  return (
    <View style={{ flex: 1 }}>
      {children as any}

      <View
        pointerEvents="box-only"
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: edgeWidth,
        }}
      >
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1 }} />
        </GestureDetector>
      </View>

      <View
        pointerEvents="box-only"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: edgeWidth,
        }}
      >
        <GestureDetector gesture={pan}>
          <View style={{ flex: 1 }} />
        </GestureDetector>
      </View>
    </View>
  );
}


