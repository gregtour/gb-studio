export const id = "EVENT_IF_ACTOR_DIRECTION";

export const fields = [
  {
    key: "actorId",
    type: "actor",
    defaultValue: "player"
  },
  {
    key: "direction",
    type: "direction",
    defaultValue: "up"
  },
  {
    key: "true",
    type: "events"
  },
  {
    key: "false",
    type: "events"
  }
];

export const compile = (input, helpers) => {
  const { actorSetActive, ifActorDirection } = helpers;
  actorSetActive(input.actorId);
  ifActorDirection(input.direction, input.true, input.false);
};
