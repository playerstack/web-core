/**
 * Definition entry used by `registerPlayerstackElements` to define a
 * Custom Element under the `playerstack-` prefix.
 */
export interface PlayerstackElementDefinition {
  /** Custom Element tag name; always prefixed with `playerstack-`. */
  name: `playerstack-${string}`;
  /** Constructor to register in the `CustomElementRegistry`. */
  ctor: CustomElementConstructor;
}
