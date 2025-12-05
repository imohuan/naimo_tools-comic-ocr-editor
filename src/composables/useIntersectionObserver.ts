import type { ComponentPublicInstance, Ref } from "vue";
import { onBeforeUnmount, onMounted, ref } from "vue";

interface UseIntersectionObserverOptions {
  rootRef?: Ref<HTMLElement | null>;
  rootMargin?: string;
  threshold?: number | number[];
  onIntersect: (entry: IntersectionObserverEntry) => void;
}

const resolveElement = (target: Element | ComponentPublicInstance): Element => {
  const component = target as ComponentPublicInstance;
  if (component.$el) {
    return component.$el as Element;
  }
  return target as Element;
};

export const useIntersectionObserver = (options: UseIntersectionObserverOptions) => {
  const { rootRef, rootMargin = "0px", threshold = 0, onIntersect } = options;

  const observer = ref<IntersectionObserver | null>(null);
  const observedElements = new Set<Element>();
  const pendingElements: Element[] = [];

  const observeElement = (element: Element) => {
    if (!observer.value || observedElements.has(element)) return;
    observer.value.observe(element);
    observedElements.add(element);
  };

  const unobserveAll = () => {
    if (!observer.value) return;
    observedElements.forEach((el) => observer.value?.unobserve(el));
    observedElements.clear();
  };

  const registerElement = (el: Element | ComponentPublicInstance | null) => {
    if (!el) return;
    const element = resolveElement(el);

    if (!observer.value) {
      pendingElements.push(element);
      return;
    }
    observeElement(element);
  };

  onMounted(() => {
    observer.value = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          onIntersect(entry);
        });
      },
      {
        root: rootRef?.value || null,
        rootMargin,
        threshold,
      }
    );

    if (pendingElements.length) {
      pendingElements.forEach((el) => observeElement(el));
      pendingElements.length = 0;
    }
  });

  onBeforeUnmount(() => {
    unobserveAll();
    observer.value?.disconnect();
    observer.value = null;
  });

  const resetObserver = () => {
    unobserveAll();
  };

  return {
    registerElement,
    resetObserver,
  };
};

