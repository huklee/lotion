import {
  BlockColorsItem,
  DragHandleMenu,
  SideMenu,
  SideMenuController,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useComponentsContext,
  useDictionary,
  useExtensionState,
} from "@blocknote/react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import { useContext, type ReactNode } from "react";
import type { Block } from "../../packages/document-schema/index";
import { removeBlocksPreservingHierarchy } from "../../packages/editor-adapter/movement";
import { BlockIssueContext, createIssueFromBlock } from "./issues/block-issue";

/** "Create issue": an issue titled by the block, linked back to it. */
function CreateIssueItem() {
  const Components = useComponentsContext();
  const editor = useBlockNoteEditor();
  const page = useContext(BlockIssueContext);
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state: any) => state?.block,
  }) as { id: string } | undefined;
  if (!block || !Components || !page) return null;
  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => {
        const current = editor.getBlock(block.id) ?? block;
        void createIssueFromBlock(current as any, page);
      }}
    >
      Create issue
    </Components.Generic.Menu.Item>
  );
}

/**
 * "Delete" in the block handle menu: removes the block (or the selected blocks it
 * belongs to) but keeps unselected nested blocks, which move up into its place.
 * BlockNote's default item removed the whole subtree.
 */
function DeleteKeepingChildren({ children }: { children: ReactNode }) {
  const Components = useComponentsContext();
  const editor = useBlockNoteEditor();
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state: any) => state?.block,
  }) as { id: string } | undefined;
  if (!block || !Components) return null;
  return (
    <Components.Generic.Menu.Item
      className="bn-menu-item"
      onClick={() => {
        const selection = editor.getSelection()?.blocks;
        const targets =
          selection && selection.some((b) => b.id === block.id)
            ? selection
            : [block];
        const current = editor.document as unknown as Block[];
        const next = removeBlocksPreservingHierarchy(
          current,
          targets.map((b) => b.id),
        );
        if (next === current) return;
        editor.replaceBlocks(
          editor.document,
          (next.length ? next : [{ type: "paragraph" }]) as any,
        );
      }}
    >
      {children}
    </Components.Generic.Menu.Item>
  );
}

function LotionDragHandleMenu() {
  const dict = useDictionary();
  return (
    <DragHandleMenu>
      <DeleteKeepingChildren>
        {dict.drag_handle.delete_menuitem}
      </DeleteKeepingChildren>
      <BlockColorsItem>{dict.drag_handle.colors_menuitem}</BlockColorsItem>
      <CreateIssueItem />
      <TableRowHeaderItem>
        {dict.drag_handle.header_row_menuitem}
      </TableRowHeaderItem>
      <TableColumnHeaderItem>
        {dict.drag_handle.header_column_menuitem}
      </TableColumnHeaderItem>
    </DragHandleMenu>
  );
}

/** The block side menu (+ and ⋮⋮) with Lotion's handle menu. */
export function LotionSideMenu() {
  return (
    <SideMenuController
      sideMenu={(props) => (
        <SideMenu {...props} dragHandleMenu={LotionDragHandleMenu} />
      )}
    />
  );
}
