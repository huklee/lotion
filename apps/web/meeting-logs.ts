/** Block props for a new "Meeting logs" database: a meeting-oriented preset. */
export function meetingLogProps() {
  const id = () => crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  const date = { id: id(), name: "Date", type: "date" };
  const type = {
    id: id(),
    name: "Type",
    type: "select",
    options: ["Weekly", "1:1", "Review", "Ad-hoc"],
  };
  const attendees = { id: id(), name: "Attendees", type: "text" };
  return {
    variant: "meetings",
    title: "Meeting logs",
    columns: JSON.stringify([date, type, attendees]),
    rows: "[]",
    views: JSON.stringify([
      {
        id: "feed",
        name: "Feed",
        type: "feed",
        sort: [{ columnId: date.id, direction: "desc" }],
        filters: [],
        hidden: [],
      },
      {
        id: "default",
        name: "Table",
        type: "table",
        sort: [{ columnId: date.id, direction: "desc" }],
        filters: [],
        hidden: [],
      },
    ]),
  };
}
