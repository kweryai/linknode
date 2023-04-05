## Linknode

This library provides the functionality for LinkNode nodes and chains.

It only has 4 main classes:

`Chain` --> an event emitter 

`ChainNode` --> the wiring for transitions

`Transition` --> transition to another node if condition is met. Each transition contains a condition function and a transformer.

`Transformer` --> used to map from one node data type to the next

## Examples

```typescript

const chain = new Chain({});
const terminalNode = new TerminalNode(chain, "TerminalEvent");
const routerNode = new ChainNode<RouterEvent>(chain, "RouterEvent");
const sqlNode = new ChainNode<SQLEvent>(chain, "SQLEvent");
const nlNode = new ChainNode<RouterEvent>(chain, "NLEvent");


async function shouldTransitionToNL(data: RouterEvent) {
  return !data.query.includes("SELECT");
}

async function shouldTransitionToSQL(data: RouterEvent) {
  return data.query.includes("SELECT");
}

const NLInputDescriptor = t.type({
  query: t.string
});
type NLTransitionInput = t.TypeOf<typeof NLInputDescriptor>;
const NLEventDescriptor = t.type({ query: t['string'], model: t['string'], name: t.string });

type NLEvent = t.TypeOf<typeof NLEventDescriptor>;

const NLTransition: Transition<NLTransitionInput, NLEvent> = {
  condition: (data) => shouldTransitionToNL(data),
  event: nlNode.event,
  transformer: {
    transform: (data) => {
      return Promise.resolve({...data, model: "User", name: 'Cam'});
    }
  }
}

routerNode.addTransition(NLTransition);

// routerNode.addTransition({
//   condition: shouldTransitionToSQL,
//   event: sqlNode.event,
//   transformer: {
//     transform: (data: RouterEvent) => {
//       return Promise.resolve(data);
//     }
//   }
// });

// sqlNode.addTransition({
//   async condition(data: SQLEvent, context: Chain) {
//     return true;
//   },
//   event: terminalNode.event,
//   transformer: {
//     transform: (data: SQLEvent) => {
//       return Promise.resolve(data);
//     }
//   }
// });

// nlNode.addTransition({
//   condition: () => Promise.resolve(true),
//   event: terminalNode.event,
//   transformer: {
//     transform: (data: RouterEvent) => {
//       return Promise.resolve(data);
//     }
//   }
// });

chain.emit("RouterEvent", { query: "Hello how are you?" });
```