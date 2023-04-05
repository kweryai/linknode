
import EventEmitter from "events";
import debug from "debug";

const log = debug("linknode");
export interface Transformer<I,T, G> {
  transform: (data: I, context?: G) => Promise<T>;
}

export interface Transition<I = any, T = any, G = any> {
  condition: (data: I, context?: G) => Promise<boolean>;
  event: string;
  transformer: Transformer<I,T,G>;
}

interface Execute<I,O> {
  (prev: I | O | undefined, data: I, context?: any): Promise<O> | O;
}

export class Chain<G = any> extends EventEmitter {
  constructor(public readonly context: G) {
    super();

    log('setting up chain');
  }
}

export interface ChainNodeArgs<I, O = any> {
  /** The chain this node belongs to */
  chain: Chain;
  /** The name of this node */
  event: string;
  /** the function that will be called when the node is executed.
   * this function should return a promise that resolves to the data that will be passed to the `resolve` method. */
  execute?: Execute<I,O>;
  /** optional initial transitions to add to this node */
  transitions?: Transition[];
}

export class ChainNode<I, O = any> {
  
  protected execute?: Execute<I,O>;
  protected chain: Chain;
  public readonly event: string;
  protected transitions?: Transition[];
  protected transformed?: I | O;
  
  constructor(
    args: ChainNodeArgs<I, O>
    ) {
    const { chain, event, execute, transitions } = args;

    this.chain = chain;
    this.event = event;
    this.execute = execute;
    this.transitions = transitions;

    this.chain.on(event, async (data: I) => {
      try {
        this.transformed = this.execute ? await this.execute(
          this.transformed, data, this.chain.context) : data;

        await this.resolve(this.transformed);
      } catch(err) {
        // just emit error 
        this.chain.emit('error', err);
      }
    });
  }

  async addTransition<I = any, T = any>(transition: Transition<I, T>) {
    if (!this.transitions) {
      this.transitions = [];
    }

    this.transitions.push(transition);
  }

  /**
   * 
   * @param data - the data to be transformed after the the node has executed. 
   * 
   * This method is called after the `execute` method.
   * If you are implementing a terminal node, you should implement this method to flush the response, 
   * instead of allowing the chain to continue.
   */
  async resolve(data: I | O) {
    log('Resolving %s', this.event);
    
    // go through every transition and check if the condition is met
    // if it is, then emit the event and transform the data
    if (this.transitions) {
      for (const transition of this.transitions) {
        if (await transition.condition(data, this.chain.context)) {
          log("Transitioning to %s", transition.event);
          const transformed = await transition.transformer.transform(data, this.chain.context);
          this.chain.emit(transition.event, transformed);
        }
      }
    }
  }
}

// A Timer node that fires a `tick` event every second
export class TimerNode extends ChainNode<void, number> {
  constructor(args: ChainNodeArgs<void, number>) {
    super(args);

    let counter = 0;
    setInterval(() => {
      this.chain.emit('tick', counter++);
    }, 1000);
  }
}

// A Timeout node that fires a `timeout` event after a specified number of seconds
type TimeoutNodeArgs = ChainNodeArgs<number, number> & { timeoutSeconds: number };

export class TimeoutNode extends ChainNode<number, number> {
  private fired: boolean = false;
  constructor(args: TimeoutNodeArgs) {
    const { timeoutSeconds, ...rest } = args;
    super(rest);

    // add a timernode to the chain context if it doesn't exist
    if (!this.chain.context.timer) {
      this.chain.context.timer = new TimerNode({ chain: this.chain, event: 'TimeoutNodeTimer' });
    }

    // save time when the node was created
    const startTime = Date.now();

    this.chain.on('tick', () => {
      // use startTime to calculate the number of seconds that have passed
      const secondsPassed = Math.floor((Date.now() - startTime) / 1000);
      if (secondsPassed >= timeoutSeconds && !this.fired) {
        log("TimeoutNode: Timeout reached after %d seconds", secondsPassed);
        this.fired = true;
        this.chain.emit(args.event, secondsPassed);
      }
    });
  }
}





