import type { Nullable } from '@babylonjs/core';

export class ListNode<T> {
  value: T;
  prev: Nullable<ListNode<T>>;
  next: Nullable<ListNode<T>>;

  constructor(value: T) {
    this.value = value;
    this.prev = null;
    this.next = null;
  }
}

export class List<T> {
  length: number;
  head: Nullable<ListNode<T>>;
  tail: Nullable<ListNode<T>>;

  constructor() {
    this.length = 0;
    this.head = null;
    this.tail = null;
  }

  pushHead(value: T) {
    const newNode = new ListNode(value);
    if (this.head === null) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.next = this.head;
      this.head.prev = newNode;
      this.head = newNode;
    }
    this.length += 1;
    return newNode;
  }
  pushTail(value: T) {
    const newNode = new ListNode(value);
    if (this.tail === null) {
      this.head = newNode;
      this.tail = newNode;
    } else {
      newNode.prev = this.tail;
      this.tail.next = newNode;
      this.tail = newNode;
    }
    this.length += 1;
    return newNode;
  }
  popHead() {
    if (this.head === null) return null;

    const node = this.head;
    this.head = this.head.next;
    if (this.head) {
      this.head.prev = null;
    } else {
      this.tail = null;
    }
    this.length -= 1;
    node.next = null;
    return node;
  }
  popTail() {
    if (this.tail === null) return null;

    const node = this.tail;
    this.tail = this.tail.prev;
    if (this.tail) {
      this.tail.next = null;
    } else {
      this.head = null;
    }
    this.length -= 1;
    node.prev = null;
    return node;
  }
  clear() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }
  seekHead() {
    return this.head;
  }
  seekTail() {
    return this.tail;
  }
  delete(node: ListNode<T>) {
    if (node.next) {
      node.next.prev = node.prev;
    }
    if (node.prev) {
      node.prev.next = node.next;
    }
    node.next = null;
    node.prev = null;
    return node;
  }

  *[Symbol.iterator]() {
    let curr = this.head;
    while (curr) {
      yield curr.value;
      curr = curr.next;
    }
  }
  forEach(cb: (value: T) => void) {
    for (const value of this) {
      cb(value);
    }
  }
}
