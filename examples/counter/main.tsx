import { mount, state } from "@rect/core";

function Counter() {
  const [count, setCount] = state(0);

  return (
    <main className="counter">
      <p className="eyebrow">Rect v0</p>
      <h1>Counter</h1>
      <p>
        The component runs once. The dynamic text node subscribes directly to
        state.
      </p>
      <button type="button" onClick={() => setCount((value) => value + 1)}>
        Count: {count}
      </button>
    </main>
  );
}

const root = document.querySelector("#app");
if (!(root instanceof HTMLElement)) {
  throw new Error("Missing #app mount point.");
}

mount(<Counter />, root);
