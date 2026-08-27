/**
 * Generic typed-action reducer factory.
 * Creates a reducer that validates action types against a whitelist
 * and supports three dispatch patterns:
 * - Function actions: `dispatch((prev) => ({ type: 'x', payload: y }))`
 * - Typed actions: `dispatch({ type: 'x', payload: value })`
 * - Object merge: `dispatch({ key1: value1, key2: value2 })`
 *
 * @param validTypes - Array of valid action type strings
 * @returns A reducer function compatible with React's useReducer
 */
export function createTypedReducer<S extends Record<string, any>>(validTypes: readonly string[]) {
  return function reducer(state: S, action: any): S {
    try {
      if (!state || !action) {
        throw new Error('Reducer params has not been provided!');
      }

      // Support function actions (like useState updater pattern)
      if (typeof action === 'function') {
        const resolvedAction = action(state);
        if (!resolvedAction || typeof resolvedAction !== 'object') {
          return state;
        }
        return reducer(state, resolvedAction);
      }

      if ('type' in action) {
        const { type, payload } = action;

        if (validTypes.includes(type) === false) {
          throw new Error(`Invalid type "${type}" in action payload!`);
        }

        // Bail out if value hasn't changed to prevent unnecessary re-renders
        if ((state as any)[type] === payload) {
          return state;
        }

        return {
          ...state,
          [type]: payload,
        };
      } else if (typeof action === 'object') {
        if (Object.keys(action).length === 0) {
          throw new Error('Reducer action object is empty!');
        }

        let hasChanged = false;
        let newState = { ...state };

        for (const key in action) {
          const value = action[key];
          if (validTypes.includes(key) === false) {
            throw new Error(`Invalid type "${key}" in action object!`);
          }

          if ((state as any)[key] !== value) {
            hasChanged = true;
            newState = { ...newState, [key]: value };
          }
        }

        return hasChanged ? newState : state;
      }

      return state;
    } catch (error) {
      console.error('Error in AppReducer: ', error);
      return state;
    }
  };
}
