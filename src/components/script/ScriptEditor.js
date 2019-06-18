/* eslint-disable react/no-multi-comp */
import React, { Component } from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import cx from "classnames";
import uuid from "uuid/v4";
import { debounce } from "lodash";
import { DragSource, DropTarget } from "react-dnd";
import { TriangleIcon } from "../library/Icons";
import AddCommandButton from "./AddCommandButton";
import { FormField } from "../library/Forms";
import ScriptEventBlock from "./ScriptEventBlock";
import { EVENT_END } from "../../lib/compiler/eventTypes";
import {
  patchEvents,
  prependEvent,
  filterEvents,
  findEvent,
  appendEvent,
  regenerateEventIds
} from "../../lib/helpers/eventSystem";
import * as actions from "../../actions";
import { DropdownButton } from "../library/Button";
import { MenuItem, MenuDivider } from "../library/Menu";
import l10n from "../../lib/helpers/l10n";
import { SidebarHeading } from "../editors/Sidebar";
import {
  EventShape,
  VariableShape,
  MusicShape,
  SceneShape,
  SpriteShape
} from "../../reducers/stateShape";
import events from "../../lib/events";
import rerenderCheck from "../../lib/helpers/reactRerenderCheck";

const ItemTypes = {
  CARD: "card"
};

const cardSource = {
  beginDrag(props) {
    return {
      id: props.id,
      path: props.path
    };
  },

  canDrag(props) {
    return props.action.command !== "END";
  },

  endDrag(props, monitor) {
    const item = monitor.getItem();
    const target = monitor.getDropResult({ shallow: true });

    if (item && target) {
      props.moveActions(item.id, target.id);
    }
  }
};

const cardTarget = {
  canDrop(props, monitor) {
    return monitor.isOver({ shallow: true });
  },
  drop(props) {
    return {
      id: props.id,
      end: props.end
    };
  }
};

class ActionMini extends Component {
  constructor() {
    super();
    this.state = {
      rename: false
    };
  }

  toggleOpen = () => {
    const { id, action, onEdit } = this.props;
    onEdit(id, {
      __collapse: !action.args.__collapse
    });
  };

  toggleElseOpen = () => {
    const { id, action, onEdit } = this.props;
    onEdit(id, {
      __collapseElse: !action.args.__collapseElse
    });
  };

  toggleRename = () => {
    this.setState(prevState => {
      return {
        rename: !prevState.rename
      };
    });
  };

  submitOnEnter = e => {
    if (e.key === "Enter") {
      this.toggleRename();
    }
  };

  onPasteValues = e => {
    const { id, clipboardEvent, onEdit, action } = this.props;
    if (!clipboardEvent || Array.isArray(clipboardEvent)) {
      // Can't paste values if copied entire script, or not copied anything
      return;
    }
    // Only include values from clipboard event that existed on current event already
    const newArgs = Object.keys(clipboardEvent.args || {}).reduce(
      (memo, key) => {
        if (action.args && action.args[key] !== undefined) {
          return {
            ...memo,
            [key]: clipboardEvent.args[key]
          };
        }
        return memo;
      },
      {}
    );
    onEdit(id, newArgs);
  };

  onPasteEvent = before => e => {
    const { id, clipboardEvent, onPaste } = this.props;
    onPaste(id, clipboardEvent, before);
  };

  onEdit = newValue => {
    const { onEdit, id } = this.props;
    onEdit(id, newValue);
  };

  onEditLabel = e => {
    const { onEdit, id } = this.props;
    onEdit(id, {
      __label: e.currentTarget.value
    });
  };

  render() {
    const {
      id,
      type,
      action,
      connectDragSource,
      connectDragPreview,
      connectDropTarget,
      isDragging,
      isOverCurrent,
      moveActions,
      onAdd,
      onEdit,
      onRemove,
      onCopy,
      onPaste,
      onMouseEnter,
      onMouseLeave,
      clipboardEvent
    } = this.props;
    const { rename } = this.state;
    const { command } = action;

    if (command === EVENT_END) {
      return connectDropTarget(
        <div
          className={cx("ActionMini", "ActionMini--Add", {
            "ActionMini--Dragging": isDragging,
            "ActionMini--Over": isOverCurrent
          })}
        >
          <AddCommandButton onAdd={onAdd(id)} type={type} />
        </div>
      );
    }

    const open = action.args && !action.args.__collapse;
    const elseOpen = action.args && !action.args.__collapseElse;

    const eventName =
      (action.args.__label ? `${action.args.__label}: ` : "") +
      (l10n(command) || (events[command] && events[command].name) || command);
    const elseName = `${l10n("FIELD_ELSE")} - ${eventName}`;

    const childKeys = action.children ? Object.keys(action.children) : [];

    return connectDropTarget(
      connectDragPreview(
        <div
          className={cx("ActionMini", {
            "ActionMini--Dragging": isDragging,
            "ActionMini--Over": isOverCurrent,
            "ActionMini--Conditional": childKeys.length > 0
          })}
        >
          <div
            className="ActionMini__Content"
            onMouseEnter={() => onMouseEnter(id)}
            onMouseLeave={() => onMouseLeave(id)}
          >
            {connectDragSource(
              <div
                className={cx("ActionMini__Command", {
                  "ActionMini__Command--Open": open
                })}
                onClick={this.toggleOpen}
              >
                <TriangleIcon />{" "}
                {action.args.__label ? (
                  <span>
                    {action.args.__label}
                    <small>
                      {l10n(command) ||
                        (events[command] && events[command].name) ||
                        command}
                    </small>
                  </span>
                ) : (
                  l10n(command) ||
                  (events[command] && events[command].name) ||
                  command
                )}
              </div>
            )}

            <div className="ActionMini__Dropdown">
              <DropdownButton small transparent right>
                <MenuItem onClick={this.toggleRename}>
                  {l10n("MENU_RENAME_EVENT")}
                </MenuItem>
                <MenuDivider />
                <MenuItem onClick={onCopy(action)}>
                  {l10n("MENU_COPY_EVENT")}
                </MenuItem>
                {clipboardEvent && !Array.isArray(clipboardEvent) && (
                  <MenuDivider />
                )}
                {clipboardEvent && !Array.isArray(clipboardEvent) && (
                  <MenuItem onClick={this.onPasteValues}>
                    {l10n("MENU_PASTE_VALUES")}
                  </MenuItem>
                )}
                {clipboardEvent && (
                  <MenuItem onClick={this.onPasteEvent(true)}>
                    {l10n("MENU_PASTE_EVENT_BEFORE")}
                  </MenuItem>
                )}
                {clipboardEvent && (
                  <MenuItem onClick={this.onPasteEvent(false)}>
                    {l10n("MENU_PASTE_EVENT_AFTER")}
                  </MenuItem>
                )}
                <MenuDivider />
                <MenuItem onClick={onRemove(id)}>
                  {l10n("MENU_DELETE_EVENT")}
                </MenuItem>
              </DropdownButton>
            </div>

            {rename && (
              <div className="ActionMini__Rename">
                <FormField>
                  <div style={{ display: "flex" }}>
                    <input
                      placeholder={l10n("FIELD_LABEL")}
                      value={action.args.__label || ""}
                      autoFocus
                      onBlur={this.toggleRename}
                      onChange={this.onEditLabel}
                      onKeyDown={this.submitOnEnter}
                    />
                    <div className="SelectRenamable__EditBtn SelectRenamable__SaveBtn">
                      {l10n("FIELD_SAVE")}
                    </div>
                  </div>
                </FormField>
              </div>
            )}

            {open &&
              events[command] &&
              events[command].fields &&
              events[command].fields.filter(
                field => childKeys.indexOf(field.key) === -1
              ).length > 0 && (
                <ScriptEventBlock
                  id={action.id}
                  command={command}
                  value={action.args}
                  onChange={this.onEdit}
                />
              )}

            {open &&
              childKeys.length > 0 &&
              connectDropTarget(
                <div className="ActionMini__Children">
                  {action.children[childKeys[0]].map(childAction => (
                    <ActionMiniDnD
                      key={childAction.id}
                      id={childAction.id}
                      type={type}
                      path={`${id}_true_${childAction.id}`}
                      action={childAction}
                      moveActions={moveActions}
                      onAdd={onAdd}
                      onRemove={onRemove}
                      onEdit={onEdit}
                      onCopy={onCopy}
                      onPaste={onPaste}
                      onMouseEnter={onMouseEnter}
                      onMouseLeave={onMouseLeave}
                      clipboardEvent={clipboardEvent}
                    />
                  ))}
                  <div
                    className="ActionMini__ChildrenBorder"
                    title={eventName}
                  />
                </div>
              )}

            {childKeys.length > 1 &&
              childKeys.map((key, index) => {
                if (index === 0) {
                  return [];
                }
                return [
                  <div
                    key={`child_${key}_header`}
                    className={cx("ActionMini__Else", {
                      "ActionMini__Else--Open": elseOpen
                    })}
                    onClick={this.toggleElseOpen}
                  >
                    <TriangleIcon /> Else
                  </div>,
                  elseOpen && (
                    <div
                      key={`child_${key}_body`}
                      className="ActionMini__Children"
                    >
                      {action.children[key].map(childAction => (
                        <ActionMiniDnD
                          key={childAction.id}
                          id={childAction.id}
                          type={type}
                          path={`${id}_true_${childAction.id}`}
                          action={childAction}
                          moveActions={moveActions}
                          onAdd={onAdd}
                          onRemove={onRemove}
                          onEdit={onEdit}
                          onCopy={onCopy}
                          onPaste={onPaste}
                          onMouseEnter={onMouseEnter}
                          onMouseLeave={onMouseLeave}
                          clipboardEvent={clipboardEvent}
                        />
                      ))}
                      <div
                        className="ActionMini__ChildrenBorder"
                        title={elseName}
                      />
                    </div>
                  )
                ];
              })}
          </div>
        </div>
      )
    );
  }
}

ActionMini.propTypes = {
  id: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  action: EventShape.isRequired,
  isDragging: PropTypes.bool.isRequired,
  isOverCurrent: PropTypes.bool.isRequired,
  onAdd: PropTypes.func.isRequired,
  onEdit: PropTypes.func.isRequired,
  onRemove: PropTypes.func.isRequired,
  onCopy: PropTypes.func.isRequired,
  onPaste: PropTypes.func.isRequired,
  moveActions: PropTypes.func.isRequired,
  onMouseLeave: PropTypes.func.isRequired,
  onMouseEnter: PropTypes.func.isRequired,
  connectDragSource: PropTypes.func.isRequired,
  connectDragPreview: PropTypes.func.isRequired,
  connectDropTarget: PropTypes.func.isRequired,
  clipboardEvent: PropTypes.oneOfType([
    EventShape,
    PropTypes.arrayOf(EventShape)
  ])
};

ActionMini.defaultProps = {
  clipboardEvent: null
};

const ActionMiniDnD = DropTarget(
  ItemTypes.CARD,
  cardTarget,
  (dndConnect, monitor) => ({
    connectDropTarget: dndConnect.dropTarget(),
    isOver: monitor.isOver(),
    isOverCurrent: monitor.isOver({ shallow: true })
  })
)(
  DragSource(ItemTypes.CARD, cardSource, (dndConnect, monitor) => ({
    connectDragSource: dndConnect.dragSource(),
    connectDragPreview: dndConnect.dragPreview(),
    isDragging: monitor.isDragging()
  }))(ActionMini)
);

class ScriptEditor extends Component {
  shouldComponentUpdate(nextProps, nextState) {
    // const { value } = this.state;
    console.log("SHOULD UPDATE SCRIPT EDITOR");

    rerenderCheck("ScriptEditor", this.props, {}, nextProps, {});

    // return (
    //   nextState.value !== value || nextProps.clipboardEvent !== clipboardEvent
    // );
    return true;
  }

  onChange = newValue => {
    const { onChange } = this.props;
    onChange(newValue);
    // this.setState({ value: newValue });
    // this.debouncedOnChange(newValue);
    // this.onChange(new)
  };

  moveActions = (a, b) => {
    const { value: root } = this.props;
    if (a === b) {
      return;
    }
    const input = prependEvent(filterEvents(root, a), b, findEvent(root, a));
    this.onChange(input);
  };

  onAdd = id => (command, defaults = {}) => {
    const {
      variableIds,
      musicIds,
      sceneIds,
      actorIds,
      spriteSheetIds
    } = this.props;
    const { value: root } = this.props;
    const eventFields = events[command].fields;
    const defaultArgs = eventFields
      ? eventFields.reduce(
          (memo, field) => {
            let replaceValue = null;
            if (field.defaultValue === "LAST_SCENE") {
              replaceValue = sceneIds[sceneIds.length - 1];
            } else if (field.defaultValue === "LAST_VARIABLE") {
              replaceValue =
                variableIds.length > 0
                  ? variableIds[variableIds.length - 1]
                  : "0";
            } else if (field.defaultValue === "LAST_MUSIC") {
              replaceValue = musicIds[0];
            } else if (field.defaultValue === "LAST_SPRITE") {
              replaceValue = spriteSheetIds[0];
            } else if (field.defaultValue === "LAST_ACTOR") {
              replaceValue =
                actorIds.length > 0 ? actorIds[actorIds.length - 1] : "player";
            } else if (field.type === "events") {
              replaceValue = undefined;
            } else if (
              field.defaultValue !== undefined &&
              !defaults[field.key]
            ) {
              replaceValue = field.defaultValue;
            }
            if (replaceValue !== null) {
              return {
                ...memo,
                [field.key]: replaceValue
              };
            }
            return memo;
          },
          { ...defaults }
        )
      : { ...defaults };

    const childFields = eventFields.filter(field => field.type === "events");
    const children = childFields.reduce((memo, field) => {
      return {
        ...memo,
        [field.key]: [
          {
            id: uuid(),
            command: EVENT_END
          }
        ]
      };
    }, {});

    const input = prependEvent(
      root,
      id,
      Object.assign(
        {
          id: uuid(),
          command,
          args: defaultArgs
        },
        childFields.length > 0 && {
          children
        }
      )
    );
    this.onChange(input);
  };

  onRemove = id => () => {
    const { value } = this.props;
    const input = filterEvents(value, id);
    this.onChange(input);
  };

  onEdit = (id, patch) => {
    const { value } = this.props;
    const input = patchEvents(value, id, patch);
    this.onChange(input);
  };

  onCopy = event => () => {
    const { copyEvent } = this.props;
    copyEvent(event);
  };

  onCopyScript = () => {
    const { copyEvent } = this.props;
    const { value } = this.props;
    console.log("COPY EVENT", value);
    copyEvent(value);
  };

  onPaste = (id, event, before) => {
    const { value } = this.props;
    const newEvent = Array.isArray(event)
      ? event.slice(0, -1).map(regenerateEventIds)
      : regenerateEventIds(event);
    const input = before
      ? prependEvent(value, id, newEvent)
      : appendEvent(value, id, newEvent);
    this.onChange(input);
  };

  onRemoveScript = e => {
    this.onChange([
      {
        id: uuid(),
        command: EVENT_END
      }
    ]);
  };

  onReplaceScript = e => {
    const { clipboardEvent } = this.props;
    if (clipboardEvent) {
      this.onChange(
        []
          .concat(
            clipboardEvent,
            !Array.isArray(clipboardEvent)
              ? {
                  id: uuid(),
                  command: EVENT_END
                }
              : []
          )
          .map(regenerateEventIds)
      );
    }
  };

  onPasteScript = before => () => {
    const { clipboardEvent } = this.props;
    const { value } = this.props;
    const newEvent = Array.isArray(clipboardEvent)
      ? clipboardEvent.slice(0, -1).map(regenerateEventIds)
      : regenerateEventIds(clipboardEvent);
    if (clipboardEvent) {
      if (before) {
        this.onChange([].concat(newEvent, value));
      } else {
        this.onChange([].concat(value.slice(0, -1), newEvent, value.slice(-1)));
      }
    }
  };

  onEnter = id => {
    const { selectScriptEvent } = this.props;
    // selectScriptEvent(id);
  };

  onLeave = id => {
    const { selectScriptEvent } = this.props;
    // selegctScriptEvent("");
  };

  render() {
    const { type, title, clipboardEvent } = this.props;
    const { value } = this.props;
    console.log("render: ScriptEditor.js");
    return (
      <div>
        <SidebarHeading
          title={title}
          buttons={
            <DropdownButton small transparent right>
              <MenuItem onClick={this.onCopyScript}>
                {l10n("MENU_COPY_SCRIPT")}
              </MenuItem>
              {clipboardEvent && <MenuDivider />}
              {clipboardEvent && (
                <MenuItem onClick={this.onReplaceScript}>
                  {l10n("MENU_REPLACE_SCRIPT")}
                </MenuItem>
              )}
              {clipboardEvent && value && value.length > 1 && (
                <MenuItem onClick={this.onPasteScript(true)}>
                  {l10n("MENU_PASTE_SCRIPT_BEFORE")}
                </MenuItem>
              )}
              {clipboardEvent && value && value.length > 1 && (
                <MenuItem onClick={this.onPasteScript(false)}>
                  {l10n("MENU_PASTE_SCRIPT_AFTER")}
                </MenuItem>
              )}
              <MenuDivider />
              <MenuItem onClick={this.onRemoveScript}>
                {l10n("MENU_DELETE_SCRIPT")}
              </MenuItem>
            </DropdownButton>
          }
        />{" "}
        <div className="ScriptEditor">
          {value.map(action => (
            <ActionMiniDnD
              key={action.id}
              id={action.id}
              type={type}
              action={action}
              moveActions={this.moveActions}
              onAdd={this.onAdd}
              onRemove={this.onRemove}
              onEdit={this.onEdit}
              onCopy={this.onCopy}
              onPaste={this.onPaste}
              onMouseEnter={this.onEnter}
              onMouseLeave={this.onLeave}
              clipboardEvent={clipboardEvent}
            />
          ))}
        </div>
      </div>
    );
  }
}

ScriptEditor.propTypes = {
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  value: PropTypes.arrayOf(PropTypes.shape({})),
  onChange: PropTypes.func.isRequired,
  variableIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  musicIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  sceneIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  actorIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  spriteSheetIds: PropTypes.arrayOf(PropTypes.string).isRequired,
  selectScriptEvent: PropTypes.func.isRequired,
  copyEvent: PropTypes.func.isRequired
};

ScriptEditor.defaultProps = {
  value: [
    {
      id: uuid(),
      command: EVENT_END
    }
  ],
  clipboardEvent: null
};

function mapStateToProps(state) {
  const { result, entities } = state.entities.present;
  return {
    variableIds: result.variables,
    sceneIds: result.scenes,
    actorIds: entities.scenes[state.editor.scene].actors,
    musicIds: result.music,
    spriteSheetIds: result.spriteSheets,
    clipboardEvent: null
  };
}

const mapDispatchToProps = {
  selectScriptEvent: actions.selectScriptEvent,
  copyEvent: actions.copyEvent
};

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(ScriptEditor);
