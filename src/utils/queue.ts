import { List, ListNode } from './list';

export class IndexedQueue<I extends string | number | symbol, T> {
  private list = new List<T>();
  private index: Partial<Record<I, ListNode<T>>> = {};
  private indexName: keyof T;

  get length() {
    return this.list.length;
  }

  constructor(items: T[], indexName: keyof T) {
    this.list = new List<T>();
    this.indexName = indexName;

    if (Array.isArray(items)) {
      items.forEach((item) => this.push(item));
    }
  }

  push(value: T) {
    const node = this.list.pushTail(value);
    this.index[value[this.indexName] as I] = node;
  }
  pop() {
    const node = this.list.popHead();
    if (node !== null) {
      delete this.index[node.value[this.indexName] as I];
      return node.value;
    }
    return null;
  }
  seek() {
    const node = this.list.head;
    if (node !== null) return node.value;
    return null;
  }
  seekLast() {
    const node = this.list.tail;
    if (node !== null) return node.value;
    return null;
  }
  clear() {
    this.list.clear();
    this.index = {};
  }
  clearTill(idx: I) {
    const node = this.index[idx];
    if (!node) {
      console.log('node not found');
      return;
    }

    if (node.next) {
      node.next.prev = null;
      this.list.head = node.next;
      node.next = null;

      let curr: ListNode<T> | null = node;
      delete this.index[curr.value[this.indexName] as I];
      this.list.length -= 1;
      while ((curr = curr.prev) !== null) {
        delete this.index[curr.value[this.indexName] as I];
        this.list.length -= 1;
      }
      console.log('cleared');
    } else {
      this.clear();
      console.log('cleared all');
    }
  }
  *#traverse() {
    let curr = this.list.head;
    while (curr) {
      yield curr.value;
      curr = curr.next;
    }
  }
  [Symbol.iterator]() {
    return this.#traverse();
  }
  forEach(cb: (value: T) => void) {
    for (const value of this) {
      cb(value);
    }
  }
}
