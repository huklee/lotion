import { createExtension } from "@blocknote/core";
import { Extension, textInputRule } from "@tiptap/core";

const arrowInputRules = [
  textInputRule({ find: /<-$/, replace: "←" }),
  textInputRule({ find: /->$/, replace: "→" }),
];

export const ArrowSubstitutionExtension = createExtension({
  key: "arrow-substitution",
  tiptapExtensions: [
    Extension.create({
      name: "lotion-arrow-substitution",
      addInputRules: () => arrowInputRules,
    }),
  ],
});
